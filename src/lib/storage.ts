import {
  Member,
  MemberApprovalStatus,
  JoinRequest,
  JoinRequestInput,
  JoinRequestStatus,
  SiteSettings,
  AdminUser,
  AuditLog,
  PageView,
  MemberView,
  SearchView,
} from '../types';
import initialMembersRaw from '../data/initialMembers.json';
import initialAnalyticsRaw from '../data/initialAnalytics.json';
import { supabase, isSupabaseConfigured } from './supabase';

const STORAGE_KEYS = {
  MEMBERS: 'cse_archive_members_v1',
  SETTINGS: 'cse_archive_settings_v1',
  ADMIN_USERS: 'cse_archive_admin_users_v1',
  AUDIT_LOGS: 'cse_archive_audit_logs_v1',
  PAGE_VIEWS: 'cse_archive_page_views_v1',
  MEMBER_VIEWS: 'cse_archive_member_views_v1',
  SEARCH_VIEWS: 'cse_archive_search_views_v1',
  JOIN_REQUESTS: 'cse_archive_join_requests_v1',
};

/**
 * Row caps for the append-only localStorage history.
 *
 * The browser grants every origin one small, shared localStorage budget
 * (commonly 5–10 MB, and far less when the page runs in a partitioned
 * third-party context). The member directory alone needs ~800 KB, so the
 * history has to stay deliberately small: these caps hold the total near
 * 1.2 MB at steady state instead of creeping past 2 MB, where every write
 * starts failing with QuotaExceededError.
 */
const STORAGE_LIMITS: Record<string, number> = {
  [STORAGE_KEYS.PAGE_VIEWS]: 400,
  [STORAGE_KEYS.MEMBER_VIEWS]: 300,
  [STORAGE_KEYS.SEARCH_VIEWS]: 400,
  [STORAGE_KEYS.AUDIT_LOGS]: 200,
  [STORAGE_KEYS.JOIN_REQUESTS]: 200,
};

/**
 * Keys whose oldest rows may be dropped to reclaim space. The member
 * directory is deliberately absent — it is the only irreplaceable key, so it
 * is never trimmed to make room for analytics.
 */
const PRUNABLE_KEYS = Object.keys(STORAGE_LIMITS);

/** Marks compaction as done so the rewrite below runs at most once. */
const COMPACTION_KEY = 'cse_archive_storage_compacted_v2';

const DEFAULT_SETTINGS: SiteSettings = {
  id: 1,
  title: 'CSE Archive',
  subtitle: 'Alumni and Directory System',
  header_title: 'Department of Computer Science and Engineering',
  description: 'Archive and Member Directory for CSE Alumni, Faculty, and Students.',
  logo_url: '',
  footer_text: '© 2026 Department of Computer Science and Engineering. All rights reserved.',
  contact_email: 'alumni@cse-archive.edu',
  contact_phone: '+880 1700 000000',
  updated_at: new Date().toISOString(),
};

/**
 * One-time copy cleanup.
 *
 * Site settings persist in localStorage, so editing DEFAULT_SETTINGS alone
 * would leave existing installs showing the previous wording forever. This
 * rewrites only values that still match a known previous default, which means
 * any wording an admin has customised by hand is left untouched.
 */
const SETTINGS_COPY_MIGRATIONS: { from: string; to: string }[] = [
  { from: 'Department of Computer Science & Engineering', to: 'Department of Computer Science and Engineering' },
  {
    from: 'Official Archive & Member Directory for CSE Alumni, Faculty, and Students.',
    to: 'Archive and Member Directory for CSE Alumni, Faculty, and Students.',
  },
  {
    from: 'Alumni & Directory System',
    to: 'Alumni and Directory System',
  },
  {
    from: '© 2026 Department of Computer Science & Engineering. All rights reserved.',
    to: '© 2026 Department of Computer Science and Engineering. All rights reserved.',
  },
];

const COPY_MIGRATION_KEY = 'cse_archive_copy_migration_v1';

function migrateSettingsCopy(): void {
  try {
    if (localStorage.getItem(COPY_MIGRATION_KEY)) return;

    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (raw) {
      const settings = JSON.parse(raw) as SiteSettings;
      let changed = false;

      for (const field of ['header_title', 'description', 'subtitle', 'footer_text'] as const) {
        const current = settings[field];
        const migration = SETTINGS_COPY_MIGRATIONS.find((m) => m.from === current);
        if (migration) {
          settings[field] = migration.to;
          changed = true;
        }
      }

      if (changed) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      }
    }

    localStorage.setItem(COPY_MIGRATION_KEY, new Date().toISOString());
  } catch (err) {
    console.error('Settings copy migration failed:', err);
  }
}

const DEFAULT_ADMINS: AdminUser[] = [
  {
    id: 'admin-super-mohatamim',
    user_id: 'user-super-mohatamim',
    email: 'mohatamimhaque@outlook.com',
    role: 'super_admin',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

// Helper to safely read JSON from localStorage
function getLocal<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;
    return JSON.parse(item);
  } catch (err) {
    console.error(`Error loading key ${key}:`, err);
    return defaultValue;
  }
}

// Helper to safely write JSON to localStorage
function setLocal<T>(key: string, value: T): void {
  const raw = JSON.stringify(value);
  try {
    localStorage.setItem(key, raw);
  } catch (err) {
    // Out of quota. Reclaiming the prunable history almost always frees enough
    // room, so retry once before giving up and reporting the failure.
    if (!reclaiming && reclaimStorage(key)) {
      try {
        localStorage.setItem(key, raw);
        return;
      } catch (retryErr) {
        console.error(`Error saving key ${key} after reclaim:`, retryErr);
        return;
      }
    }
    console.error(`Error saving key ${key}:`, err);
  }
}

/** Guards reclaimStorage() from re-entering setLocal()'s retry path. */
let reclaiming = false;

/** Total bytes currently held by the app's own localStorage keys. */
function usedStorageBytes(): number {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    total += (localStorage.getItem(k) || '').length * 2;
  }
  return total;
}

/**
 * Trims the prunable history keys (newest rows kept) until the origin is back
 * under budget, then trims the failed key itself.
 *
 * The member directory is never touched: losing it would wipe the archive,
 * and it is restorable from Supabase. Analytics and audit rows are
 * regenerable/lossy by nature, so they absorb the pressure instead.
 */
function reclaimStorage(failedKey: string): boolean {
  // Bail out for keys we must not lose — better to report than to trim them.
  if (failedKey === STORAGE_KEYS.MEMBERS || failedKey === STORAGE_KEYS.SETTINGS) {
    return false;
  }

  reclaiming = true;
  try {
    // Shrink other history keys first, halving each pass until we fit.
    for (const key of PRUNABLE_KEYS) {
      if (key === failedKey) continue;
      const rows = getLocal<unknown[]>(key, []);
      if (!Array.isArray(rows) || rows.length === 0) continue;

      const half = Math.floor(rows.length / 2);
      if (half >= 1) {
        // Raw write: never re-enter the retry path from inside a reclaim.
        try {
          localStorage.setItem(key, JSON.stringify(rows.slice(0, half)));
        } catch {
          localStorage.removeItem(key);
        }
      } else {
        localStorage.removeItem(key);
      }

      if (usedStorageBytes() < SOFT_STORAGE_BUDGET_BYTES) return true;
    }

    // Nothing left to trim but the key that failed to save.
    const failedRows = getLocal<unknown[]>(failedKey, []);
    if (Array.isArray(failedRows) && failedRows.length > 0) {
      try {
        localStorage.setItem(failedKey, JSON.stringify(failedRows.slice(0, 1)));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  } finally {
    reclaiming = false;
  }
}

const SOFT_STORAGE_BUDGET_BYTES = 3.5 * 1024 * 1024;

const SUPABASE_SYNC_KEY = 'cse_archive_supabase_sync_issues_v1';

/**
 * Records a failed Supabase write so the admin UI can surface it.
 *
 * The app is localStorage-first and treats Supabase as a background mirror, so
 * a failed sync used to be invisible: the admin saw their change appear and had
 * no idea it never reached the database. Most commonly this is an unapplied
 * migration (PostgREST code PGRST204), which is permanent rather than transient.
 */
function notifySupabaseSyncFailure(action: string, error: unknown): void {
  try {
    const code = (error as any)?.code || '';
    const message = String((error as any)?.message || error || 'Unknown error');
    const issues = getLocal<{ action: string; code: string; message: string; at: string }[]>(
      SUPABASE_SYNC_KEY,
      []
    );

    // Collapse repeats so one broken migration cannot flood the list.
    if (issues.some((i) => i.action === action && i.code === code)) return;

    issues.unshift({ action, code, message, at: new Date().toISOString() });
    localStorage.setItem(SUPABASE_SYNC_KEY, JSON.stringify(issues.slice(0, 20)));
  } catch {
    // Never let diagnostics storage break the actual operation.
  }
}

/** Pending Supabase sync problems, newest first. Empty when healthy. */
export function getSupabaseSyncIssues(): { action: string; code: string; message: string; at: string }[] {
  return getLocal(SUPABASE_SYNC_KEY, []);
}

export function clearSupabaseSyncIssues(): void {
  try {
    localStorage.removeItem(SUPABASE_SYNC_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * One-time compaction of history that was written before the caps existed.
 *
 * Browsers that already hit QuotaExceededError are stuck: every subsequent
 * write fails, so new join requests are never cached. This trims each history
 * key down to its cap and strips the bulky per-row user-agent strings, which
 * together free enough room to resume normal operation.
 */
function compactStorageOnce(): void {
  try {
    if (localStorage.getItem(COMPACTION_KEY)) return;

    reclaiming = true;
    for (const key of PRUNABLE_KEYS) {
      const rows = getLocal<unknown[]>(key, []);
      if (!Array.isArray(rows)) continue;

      const limit = STORAGE_LIMITS[key];
      let trimmed = rows.slice(0, limit).map((row) => {
        // Replace the full UA string with a compact label.
        if (row && typeof row === 'object' && 'user_agent' in (row as Record<string, unknown>)) {
          const rec = { ...(row as Record<string, unknown>) };
          const ua = String(rec.user_agent || '');
          if (ua.length > 40) {
            const short = ua.length > 28 ? ua.slice(0, 28) + '…' : ua;
            rec.user_agent = short;
          }
          return rec;
        }
        return row;
      });

      try {
        localStorage.setItem(key, JSON.stringify(trimmed));
      } catch {
        localStorage.removeItem(key);
      }
    }

    localStorage.setItem(COMPACTION_KEY, new Date().toISOString());
  } catch (err) {
    console.error('Storage compaction failed:', err);
  } finally {
    reclaiming = false;
  }
}

// INITIALIZE SEED DATA ONCE
export function initStorage(): void {
  // Keep previously-seeded site copy in sync with DEFAULT_SETTINGS.
  migrateSettingsCopy();

  // Reclaim space from pre-cap history before anything tries to write.
  compactStorageOnce();

  if (!localStorage.getItem(STORAGE_KEYS.MEMBERS)) {
    const members = initialMembersRaw as Member[];
    setLocal(STORAGE_KEYS.MEMBERS, members);
  }

  if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
    setLocal(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  }

  if (!localStorage.getItem(STORAGE_KEYS.ADMIN_USERS)) {
    setLocal(STORAGE_KEYS.ADMIN_USERS, DEFAULT_ADMINS);
  }

  if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
    const initialLogs: AuditLog[] = [
      {
        id: 'log-1',
        actor_email: 'admin@cse-archive.edu',
        action: 'system.initialize',
        target_type: 'system',
        target_id: '1',
        details: { note: 'Initial migration of 922 records completed successfully.' },
        created_at: new Date().toISOString()
      }
    ];
    setLocal(STORAGE_KEYS.AUDIT_LOGS, initialLogs);
  }

  if (!localStorage.getItem(STORAGE_KEYS.PAGE_VIEWS)) {
    setLocal(STORAGE_KEYS.PAGE_VIEWS, initialAnalyticsRaw.pageViews || []);
  }

  if (!localStorage.getItem(STORAGE_KEYS.MEMBER_VIEWS)) {
    setLocal(STORAGE_KEYS.MEMBER_VIEWS, initialAnalyticsRaw.memberViews || []);
  }

  if (!localStorage.getItem(STORAGE_KEYS.SEARCH_VIEWS)) {
    setLocal(STORAGE_KEYS.SEARCH_VIEWS, (initialAnalyticsRaw as any).searchViews || []);
  }

  if (!localStorage.getItem(STORAGE_KEYS.JOIN_REQUESTS)) {
    setLocal(STORAGE_KEYS.JOIN_REQUESTS, []);
  }
}

// MEMBER MANAGEMENT
/**
 * Records created before the approval workflow existed have no
 * `approval_status`. They are all part of the legacy archive, so they default
 * to 'approved' — which keeps the public site behaving exactly as before.
 */
export function normalizeApproval(status?: string | null): MemberApprovalStatus {
  if (status === 'pending' || status === 'rejected' || status === 'approved') return status;
  return 'approved';
}

/** Public-safe view of a member: only admins ever need pending/rejected rows. */
export function isPublicMember(m: Member): boolean {
  return normalizeApproval(m.approval_status) === 'approved';
}

function getMembersLocal(): Member[] {
  const members = getLocal<Member[]>(STORAGE_KEYS.MEMBERS, []);
  return members.map((m) => ({ ...m, approval_status: normalizeApproval(m.approval_status) }));
}

export async function getMembersFromSupabase(): Promise<Member[]> {
  initStorage();
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('cse_archive_members')
        .select('*')
        .order('id', { ascending: true });

      if (!error && data && data.length > 0) {
        // Rows created before the approval column existed come back without it.
        // Normalise so the rest of the app can treat `approval_status` as
        // always present, defaulting the legacy archive to 'approved'.
        const normalized = (data as Member[]).map((m) => ({
          ...m,
          approval_status: normalizeApproval(m.approval_status),
        }));
        setLocal(STORAGE_KEYS.MEMBERS, normalized);
        return normalized;
      }
    } catch (err) {
      console.error('Error fetching members from Supabase:', err);
    }
  }
  return getMembersLocal();
}

/** Every member row, including pending/rejected. Admin surfaces use this. */
export function getMembers(): Member[] {
  initStorage();
  if (isSupabaseConfigured && supabase) {
    getMembersFromSupabase().catch(() => {});
  }
  return getMembersLocal();
}

/**
 * Public directory data: approved records only.
 * Every non-admin page must use this so pending/rejected members never leak.
 */
export function getPublicMembers(): Member[] {
  return getMembers().filter(isPublicMember);
}

export function saveMembers(members: Member[]): void {
  setLocal(STORAGE_KEYS.MEMBERS, members);
}

export function getMemberById(id: number): Member | undefined {
  return getMembers().find(m => m.id === id);
}

/**
 * Looks a member up by email for the self-service portal.
 * A member whose own request is still pending can sign in and see the status,
 * so this deliberately searches ALL rows rather than only approved ones.
 */
export function getMemberByEmail(email: string): Member | undefined {
  if (!email) return undefined;
  const cleanEmail = email.toLowerCase().trim();
  const members = getMembers();
  return members.find(m => m.email && m.email.toLowerCase().trim() === cleanEmail);
}

export function updateMember(id: number, updates: Partial<Member>, actorEmail?: string): Member {
  const members = getMembers();
  const index = members.findIndex(m => m.id === id);
  if (index === -1) throw new Error('Member not found');

  const updated: Member = {
    ...members[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  members[index] = updated;
  saveMembers(members);

  if (isSupabaseConfigured && supabase) {
    supabase
      .from('cse_archive_members')
      .update({
        name: updated.name,
        email: updated.email,
        mobile: updated.mobile,
        student_id: updated.student_id,
        blood: updated.blood,
        designation: updated.designation,
        organization: updated.organization,
        location: updated.location,
        photo_key: updated.photo_key,
        photo_url: updated.photo_url,
        visible: updated.visible,
        approval_status: normalizeApproval(updated.approval_status),
        reviewed_by: updated.reviewed_by ?? null,
        reviewed_at: updated.reviewed_at ?? null,
        rejection_reason: updated.rejection_reason ?? null,
        auth_user_id: updated.auth_user_id ?? null,
        updated_at: updated.updated_at,
      })
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          // PGRST204 means the table is missing a column — almost always an
          // unapplied migration, and permanent until it is run.
          const hint = (error as any).code === 'PGRST204'
            ? ' Run supabase/migrations/003_members_missing_columns.sql.'
            : '';
          console.error('Failed to sync member update to Supabase:' + hint, error);
          notifySupabaseSyncFailure('member.update', error);
        }
      });
  }

  logAudit({
    actor_email: actorEmail || 'system',
    action: 'member.update',
    target_type: 'member',
    target_id: String(id),
    details: { updatedFields: Object.keys(updates), memberName: updated.name }
  });

  return updated;
}

export function createMember(newMember: Omit<Member, 'id' | 'legacy_id' | 'created_at' | 'updated_at'>, actorEmail?: string): Member {
  const members = getMembers();

  if (newMember.email) {
    const cleanEmail = newMember.email.toLowerCase().trim();
    const existing = members.find(m => m.email && m.email.toLowerCase().trim() === cleanEmail);
    if (existing) {
      return updateMember(existing.id, newMember, actorEmail);
    }
  }

  const maxId = members.reduce((max, m) => Math.max(max, m.id || 0), 0);
  const nextId = maxId + 1;

  const created: Member = {
    ...newMember,
    id: nextId,
    legacy_id: nextId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  members.unshift(created);
  saveMembers(members);

  if (isSupabaseConfigured && supabase) {
    supabase
      .from('cse_archive_members')
      .upsert({
        id: created.id,
        legacy_id: created.legacy_id,
        name: created.name,
        email: created.email,
        mobile: created.mobile,
        student_id: created.student_id,
        blood: created.blood,
        designation: created.designation,
        organization: created.organization,
        location: created.location,
        photo_key: created.photo_key,
        photo_url: created.photo_url,
        visible: created.visible,
        approval_status: normalizeApproval(created.approval_status),
        reviewed_by: created.reviewed_by ?? null,
        reviewed_at: created.reviewed_at ?? null,
        rejection_reason: created.rejection_reason ?? null,
        auth_user_id: created.auth_user_id ?? null,
        created_at: created.created_at,
        updated_at: created.updated_at,
      })
      .then(({ error }) => {
        if (error) {
          const hint = (error as any).code === 'PGRST204'
            ? ' Run supabase/migrations/003_members_missing_columns.sql.'
            : '';
          console.error('Failed to sync member creation to Supabase:' + hint, error);
          notifySupabaseSyncFailure('member.create', error);
        }
      });
  }

  logAudit({
    actor_email: actorEmail || 'system',
    action: 'member.create',
    target_type: 'member',
    target_id: String(nextId),
    details: { name: created.name, email: created.email, student_id: created.student_id }
  });

  return created;
}

export function deleteMember(id: number, actorEmail?: string): void {
  const members = getMembers();
  const member = members.find(m => m.id === id);
  const filtered = members.filter(m => m.id !== id);
  saveMembers(filtered);

  if (isSupabaseConfigured && supabase) {
    supabase
      .from('cse_archive_members')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          console.error('Failed to sync member deletion to Supabase:', error);
          notifySupabaseSyncFailure('member.delete', error);
        }
      });
  }

  logAudit({
    actor_email: actorEmail || 'system',
    action: 'member.delete',
    target_type: 'member',
    target_id: String(id),
    details: { name: member?.name, email: member?.email }
  });
}

// JOIN REQUESTS / ADMIN APPROVAL WORKFLOW
const JOIN_TABLE = 'cse_archive_join_requests';

/**
 * Submits a new Join Archive application.
 *
 * The caller must have already verified ownership of `email` via the Supabase
 * 8-digit OTP; `emailVerified` is persisted so admins can see it was checked.
 * Writes to Supabase (authoritative) and mirrors into localStorage as a cache
 * so the admin list still renders if Supabase is unreachable.
 */
export async function submitJoinRequest(
  payload: JoinRequestInput,
  options: { emailVerified: boolean; authUserId?: string | null }
): Promise<{ success: boolean; message?: string }> {
  initStorage();

  const email = (payload.email || '').toLowerCase().trim();
  const name = (payload.name || '').trim();

  if (!email || !email.includes('@')) {
    return { success: false, message: 'A valid email address is required.' };
  }
  if (!name) {
    return { success: false, message: 'Full name is required.' };
  }

  // Guard against duplicates against both the live archive and the staging table.
  const existing = getMemberByEmail(email);
  if (existing) {
    const status = normalizeApproval(existing.approval_status);
    if (status === 'approved') {
      return { success: false, message: 'This email is already a member of the archive.' };
    }
    if (status === 'pending') {
      return { success: false, message: 'A request from this email is already awaiting review.' };
    }
  }

  const pending = getLocal<JoinRequest[]>(STORAGE_KEYS.JOIN_REQUESTS, []).find(
    (r) => r.email.toLowerCase().trim() === email && r.status === 'pending'
  );
  if (pending) {
    return { success: false, message: 'A request from this email is already awaiting review.' };
  }

  const row = {
    auth_user_id: options.authUserId ?? null,
    email,
    email_verified: options.emailVerified,
    name,
    mobile: payload.mobile ?? '',
    student_id: payload.student_id ?? '',
    blood: payload.blood ?? '',
    designation: payload.designation ?? '',
    organization: payload.organization ?? '',
    location: payload.location ?? '',
    photo_key: payload.photo_key ?? '',
    photo_url: payload.photo_url ?? '',
    status: 'pending' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // ---- Supabase is the source of truth for the request queue ----
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from(JOIN_TABLE).insert(row).select().single();

    if (error) {
      // 23505 = unique_violation on the pending-email index.
      if ((error as any).code === '23505') {
        return { success: false, message: 'A request from this email is already awaiting review.' };
      }

      // PGRST204 = PostgREST's schema cache has no such column. This is a
      // deployment problem, not a transient network blip, and it is permanent
      // until the migration below is run. Say so instead of claiming the
      // server was merely unreachable.
      const code = (error as any).code;
      if (code === 'PGRST204' || /schema cache|column .* of/i.test(error.message || '')) {
        console.error('Join requests table is missing columns. Run supabase/migrations/002:', error);
        return {
          success: false,
          message:
            'This form is not available yet — the database is missing required columns. ' +
            'Please contact the department administrator.',
        };
      }

      // RLS/network failure: fall back to local-only so the applicant isn't
      // left hanging, and surface it so the admin knows to re-check.
      console.error('Failed to submit join request to Supabase:', error);
      const local = saveJoinRequestLocal(row);
      logAudit({
        actor_email: email,
        action: 'join.request.local_fallback',
        target_type: 'join_request',
        target_id: String(local.id),
        details: { name, email, note: 'Supabase write failed; stored locally only.' },
      });
      return {
        success: true,
        message: 'Request saved, but the server could not be reached. An administrator will sync it manually.',
      };
    }

    if (data) cacheJoinRequest(data as JoinRequest);
  } else {
    saveJoinRequestLocal(row);
  }

  logAudit({
    actor_email: email,
    action: 'join.request.submitted',
    target_type: 'join_request',
    target_id: email,
    details: { name, email, student_id: payload.student_id, emailVerified: options.emailVerified },
  });

  return { success: true };
}

function saveJoinRequestLocal(row: Omit<JoinRequest, 'id'>): JoinRequest {
  const requests = getLocal<JoinRequest[]>(STORAGE_KEYS.JOIN_REQUESTS, []);
  const nextId = requests.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1;
  const created: JoinRequest = { ...row, id: nextId };
  requests.unshift(created);
  setLocal(STORAGE_KEYS.JOIN_REQUESTS, requests.slice(0, STORAGE_LIMITS[STORAGE_KEYS.JOIN_REQUESTS]));
  return created;
}

function cacheJoinRequest(request: JoinRequest): void {
  const requests = getLocal<JoinRequest[]>(STORAGE_KEYS.JOIN_REQUESTS, []);
  const idx = requests.findIndex((r) => Number(r.id) === Number(request.id));
  if (idx >= 0) requests[idx] = request;
  else requests.unshift(request);
  setLocal(STORAGE_KEYS.JOIN_REQUESTS, requests.slice(0, STORAGE_LIMITS[STORAGE_KEYS.JOIN_REQUESTS]));
}

/** All join requests, newest first. Supabase first, localStorage as fallback. */
export async function getJoinRequests(): Promise<JoinRequest[]> {
  initStorage();

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from(JOIN_TABLE)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (!error && data) {
        setLocal(STORAGE_KEYS.JOIN_REQUESTS, data as JoinRequest[]);
        return data as JoinRequest[];
      }
    } catch (err) {
      console.error('Error fetching join requests:', err);
    }
  }

  return getLocal<JoinRequest[]>(STORAGE_KEYS.JOIN_REQUESTS, []);
}

/** The request belonging to one email, if any. */
export async function getJoinRequestByEmail(email: string): Promise<JoinRequest | undefined> {
  const clean = (email || '').toLowerCase().trim();
  if (!clean) return undefined;
  const requests = await getJoinRequests();
  return requests.find((r) => r.email.toLowerCase().trim() === clean);
}

/**
 * Approves a request: promotes it into `cse_archive_members` with
 * approval_status = 'approved' and marks the staging row approved.
 */
export async function approveJoinRequest(
  requestId: number | string,
  actorEmail?: string
): Promise<{ success: boolean; message?: string }> {
  const requests = await getJoinRequests();
  const request = requests.find((r) => Number(r.id) === Number(requestId));
  if (!request) return { success: false, message: 'Join request not found.' };
  if (request.status === 'approved') return { success: false, message: 'This request was already approved.' };

  const now = new Date().toISOString();

  // 1. Create the real member record (id is assigned locally).
  const member = createMember(
    {
      name: request.name,
      email: request.email,
      mobile: request.mobile || '',
      student_id: request.student_id || '',
      blood: request.blood || '',
      designation: request.designation || '',
      organization: request.organization || '',
      location: request.location || '',
      photo_key: request.photo_key || '',
      photo_url: request.photo_url || '',
      // Approved members are public immediately.
      visible: true,
      approval_status: 'approved',
      reviewed_by: actorEmail || 'system',
      reviewed_at: now,
      rejection_reason: null,
      auth_user_id: request.auth_user_id ?? null,
    } as Omit<Member, 'id' | 'legacy_id' | 'created_at' | 'updated_at'>,
    actorEmail
  );

  // 2. Mark the staging row approved.
  await setJoinRequestStatus(request.id, 'approved', actorEmail);

  logAudit({
    actor_email: actorEmail || 'system',
    action: 'join.request.approved',
    target_type: 'member',
    target_id: String(member.id),
    details: { name: member.name, email: member.email, requestId: request.id },
  });

  return { success: true };
}

/** Rejects a request. Nothing is added to the members table. */
export async function rejectJoinRequest(
  requestId: number | string,
  reason?: string,
  actorEmail?: string
): Promise<{ success: boolean; message?: string }> {
  const request = (await getJoinRequests()).find((r) => Number(r.id) === Number(requestId));
  if (!request) return { success: false, message: 'Join request not found.' };

  await setJoinRequestStatus(request.id, 'rejected', actorEmail, reason);

  // Keep any member row created by an earlier approval in sync.
  const existing = getMemberByEmail(request.email);
  if (existing) {
    updateMember(
      existing.id,
      {
        approval_status: 'rejected',
        reviewed_by: actorEmail || 'system',
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason || '',
      },
      actorEmail
    );
  }

  logAudit({
    actor_email: actorEmail || 'system',
    action: 'join.request.rejected',
    target_type: 'join_request',
    target_id: String(request.id),
    details: { email: request.email, name: request.name, reason: reason || 'No reason provided' },
  });

  return { success: true };
}

async function setJoinRequestStatus(
  requestId: number | string,
  status: JoinRequestStatus,
  actorEmail?: string,
  reason?: string
): Promise<void> {
  const patch = {
    status,
    reviewed_by: actorEmail || 'system',
    reviewed_at: new Date().toISOString(),
    rejection_reason: status === 'rejected' ? reason || 'No reason provided' : null,
    updated_at: new Date().toISOString(),
  };

  // Local cache always updated so the UI reacts instantly.
  const requests = getLocal<JoinRequest[]>(STORAGE_KEYS.JOIN_REQUESTS, []);
  const localIdx = requests.findIndex((r) => Number(r.id) === Number(requestId));
  if (localIdx >= 0) {
    requests[localIdx] = { ...requests[localIdx], ...patch };
    setLocal(STORAGE_KEYS.JOIN_REQUESTS, requests);
  }

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from(JOIN_TABLE).update(patch).eq('id', requestId);
    if (error) {
      const hint = (error as any).code === 'PGRST204'
        ? ' Run supabase/migrations/002_join_requests_missing_columns.sql.'
        : '';
      console.error('Failed to update join request status:' + hint, error);
      notifySupabaseSyncFailure('join_request.update', error);
    }
  }
}

/** Member records created through the join flow (pending or rejected). */
export function getPendingMembers(): Member[] {
  return getMembers().filter((m) => normalizeApproval(m.approval_status) !== 'approved');
}

/** Counts for the admin sidebar badge. */
export function getApprovalCounts(): { pending: number; approved: number; rejected: number } {
  const members = getMembers();
  let pending = 0;
  let rejected = 0;
  for (const m of members) {
    const status = normalizeApproval(m.approval_status);
    if (status === 'pending') pending++;
    else if (status === 'rejected') rejected++;
  }
  return { pending, approved: members.length - pending - rejected, rejected };
}

// SITE SETTINGS
export function getSiteSettings(): SiteSettings {
  initStorage();
  return getLocal<SiteSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
}

export function updateSiteSettings(settings: Partial<SiteSettings>, actorEmail?: string): SiteSettings {
  const current = getSiteSettings();
  const updated: SiteSettings = {
    ...current,
    ...settings,
    updated_at: new Date().toISOString(),
  };

  setLocal(STORAGE_KEYS.SETTINGS, updated);

  logAudit({
    actor_email: actorEmail || 'admin',
    action: 'settings.update',
    target_type: 'site_settings',
    target_id: '1',
    details: { updatedKeys: Object.keys(settings) }
  });

  return updated;
}



// ADMIN MANAGEMENT
export function getAdminUsers(): AdminUser[] {
  initStorage();
  return getLocal<AdminUser[]>(STORAGE_KEYS.ADMIN_USERS, DEFAULT_ADMINS);
}

export function getAdminByEmail(email: string): AdminUser | undefined {
  if (!email) return undefined;
  const cleanEmail = email.toLowerCase().trim();
  
  if (cleanEmail === 'mohatamimhaque@outlook.com') {
    return {
      id: 'admin-super-mohatamim',
      user_id: 'user-super-mohatamim',
      email: 'mohatamimhaque@outlook.com',
      role: 'super_admin',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return getAdminUsers().find(a => a.email.toLowerCase() === cleanEmail);
}

export function addAdminUser(email: string, role: 'admin' | 'super_admin', actorEmail: string): AdminUser {
  const admins = getAdminUsers();
  const existing = admins.find(a => a.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    existing.role = role;
    existing.status = 'active';
    existing.updated_at = new Date().toISOString();
    setLocal(STORAGE_KEYS.ADMIN_USERS, admins);
    logAudit({
      actor_email: actorEmail,
      action: 'admin.update',
      target_type: 'admin_user',
      target_id: existing.id,
      details: { email, role, status: 'active' }
    });
    return existing;
  }

  const newAdmin: AdminUser = {
    id: 'admin-' + Date.now(),
    user_id: 'user-' + Date.now(),
    email: email.toLowerCase(),
    role,
    status: 'active',
    created_by: actorEmail,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  admins.push(newAdmin);
  setLocal(STORAGE_KEYS.ADMIN_USERS, admins);

  logAudit({
    actor_email: actorEmail,
    action: 'admin.create',
    target_type: 'admin_user',
    target_id: newAdmin.id,
    details: { email: newAdmin.email, role }
  });

  return newAdmin;
}

export function toggleAdminStatus(id: string, status: 'active' | 'disabled', actorEmail: string): void {
  const admins = getAdminUsers();
  const index = admins.findIndex(a => a.id === id);
  if (index === -1) return;

  admins[index].status = status;
  admins[index].updated_at = new Date().toISOString();
  setLocal(STORAGE_KEYS.ADMIN_USERS, admins);

  logAudit({
    actor_email: actorEmail,
    action: 'admin.toggle_status',
    target_type: 'admin_user',
    target_id: id,
    details: { email: admins[index].email, status }
  });
}

// AUDIT LOGS
export function getAuditLogs(): AuditLog[] {
  initStorage();
  return getLocal<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);
}

export function logAudit(log: Omit<AuditLog, 'id' | 'created_at'>): void {
  const logs = getAuditLogs();
  const newLog: AuditLog = {
    ...log,
    id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    created_at: new Date().toISOString(),
  };

  logs.unshift(newLog);
  setLocal(STORAGE_KEYS.AUDIT_LOGS, logs.slice(0, STORAGE_LIMITS[STORAGE_KEYS.AUDIT_LOGS]));
}

// ANALYTICS TRACKING
/**
 * Short, human-readable device label, e.g. `Chrome · Windows`.
 *
 * Storing the full `navigator.userAgent` on every tracked row cost ~110
 * characters each, and the string is identical for every row from the same
 * browser. A compact token is just as informative in the analytics table and
 * keeps a large share of the localStorage budget.
 */
function describeDevice(): string {
  if (typeof navigator === 'undefined') return 'Unknown device';
  const ua = navigator.userAgent;
  const browser =
    /\bEdg\//.test(ua) ? 'Edge'
    : /\bOPR\//.test(ua) ? 'Opera'
    : /\bFirefox\//.test(ua) ? 'Firefox'
    : /\bChrome\//.test(ua) ? 'Chrome'
    : /\bSafari\//.test(ua) ? 'Safari'
    : 'Browser';
  const platform =
    /Windows/.test(ua) ? 'Windows'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Mac OS/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'Unknown OS';
  const versionMatch = ua.match(/(?:Edg|OPR|Chrome|Firefox|Version)\/([\d.]+)/);
  const version = versionMatch ? versionMatch[1].split('.')[0] : '';
  return version ? `${browser} ${version} · ${platform}` : `${browser} · ${platform}`;
}

export function trackPageView(path: string): void {
  initStorage();
  const views = getLocal<PageView[]>(STORAGE_KEYS.PAGE_VIEWS, []);

  const newView: PageView = {
    id: Date.now(),
    path,
    ip_hash: 'beb78c1bbbd0f840',
    user_agent: describeDevice(),
    country: 'Bangladesh',
    city: 'Dhaka',
    created_at: new Date().toISOString(),
  };

  views.unshift(newView);
  setLocal(STORAGE_KEYS.PAGE_VIEWS, views.slice(0, STORAGE_LIMITS[STORAGE_KEYS.PAGE_VIEWS]));
}

export function trackMemberView(memberId: number, memberName: string): void {
  initStorage();
  const views = getLocal<MemberView[]>(STORAGE_KEYS.MEMBER_VIEWS, []);
  
  // Prevent duplicate rapid logging within 3 seconds for exact same member
  const now = Date.now();
  if (views.length > 0 && views[0].member_id === memberId && (now - new Date(views[0].created_at).getTime()) < 3000) {
    return;
  }

  const newView: MemberView = {
    id: now,
    member_id: memberId,
    member_name: memberName,
    ip_hash: 'beb78c1bbbd0f840',
    user_agent: describeDevice(),
    country: 'Bangladesh',
    city: 'Dhaka',
    created_at: new Date().toISOString(),
  };

  views.unshift(newView);
  setLocal(STORAGE_KEYS.MEMBER_VIEWS, views.slice(0, STORAGE_LIMITS[STORAGE_KEYS.MEMBER_VIEWS]));
}

export function getPageViews(): PageView[] {
  initStorage();
  const views = getLocal<PageView[]>(STORAGE_KEYS.PAGE_VIEWS, []);
  if (!views || views.length === 0) {
    return initialAnalyticsRaw.pageViews as PageView[];
  }
  return views;
}

export function getMemberViews(): MemberView[] {
  initStorage();
  const views = getLocal<MemberView[]>(STORAGE_KEYS.MEMBER_VIEWS, []);
  if (!views || views.length === 0) {
    return initialAnalyticsRaw.memberViews as MemberView[];
  }
  return views;
}

/**
 * Records a directory search along with how many alumni matched.
 * Blank queries are ignored, and identical repeated queries inside
 * `debounceMs` are collapsed so a single search isn't logged per keystroke.
 */
export function trackSearch(
  query: string,
  resultsCount: number,
  options: { source?: SearchView['source']; filters?: string; debounceMs?: number } = {}
): void {
  initStorage();

  const trimmed = (query || '').trim();
  if (!trimmed) return;

  const { source = 'desktop', filters, debounceMs = 1500 } = options;

  const views = getLocal<SearchView[]>(STORAGE_KEYS.SEARCH_VIEWS, []);
  const now = Date.now();

  // Collapse rapid duplicates of the same query (same text + same result count).
  const newest = views[0];
  if (
    newest &&
    newest.query.toLowerCase() === trimmed.toLowerCase() &&
    newest.results_count === resultsCount &&
    now - new Date(newest.created_at).getTime() < debounceMs
  ) {
    return;
  }

  const newView: SearchView = {
    id: now,
    query: trimmed,
    results_count: Math.max(0, resultsCount || 0),
    source,
    filters,
    ip_hash: 'beb78c1bbbd0f840',
    user_agent: describeDevice(),
    country: 'Bangladesh',
    city: 'Dhaka',
    created_at: new Date().toISOString(),
  };

  views.unshift(newView);
  setLocal(STORAGE_KEYS.SEARCH_VIEWS, views.slice(0, STORAGE_LIMITS[STORAGE_KEYS.SEARCH_VIEWS]));
}

export function getSearchViews(): SearchView[] {
  initStorage();
  const views = getLocal<SearchView[]>(STORAGE_KEYS.SEARCH_VIEWS, []);
  if (!views || views.length === 0) {
    return ((initialAnalyticsRaw as any).searchViews || []) as SearchView[];
  }
  return views;
}

/** Aggregated search insights: top queries, no-result queries, totals. */
export function getSearchAnalytics() {
  initStorage();
  const searches = getSearchViews();

  const queryMap: Record<string, { query: string; searches: number; results: number; lastSearched: string }> = {};

  for (const sv of searches) {
    const key = (sv.query || '').trim().toLowerCase();
    if (!key) continue;

    if (!queryMap[key]) {
      queryMap[key] = { query: sv.query, searches: 0, results: 0, lastSearched: sv.created_at };
    }
    queryMap[key].searches += 1;
    queryMap[key].results += sv.results_count || 0;
    if (new Date(sv.created_at).getTime() > new Date(queryMap[key].lastSearched).getTime()) {
      queryMap[key].lastSearched = sv.created_at;
    }
  }

  const topQueries = Object.values(queryMap)
    .map((entry) => ({ ...entry, avgResults: entry.searches ? Math.round(entry.results / entry.searches) : 0 }))
    .sort((a, b) => b.searches - a.searches);

  const noResultQueries = Object.values(queryMap)
    .filter((entry) => entry.results === 0)
    .sort((a, b) => b.searches - a.searches);

  const totalResults = searches.reduce((sum, sv) => sum + (sv.results_count || 0), 0);

  return {
    totalSearches: searches.length,
    uniqueQueries: topQueries.length,
    noResultSearches: searches.filter((sv) => (sv.results_count || 0) === 0).length,
    averageResults: searches.length ? Math.round(totalResults / searches.length) : 0,
    mobileSearches: searches.filter((sv) => sv.source === 'mobile').length,
    desktopSearches: searches.filter((sv) => sv.source === 'desktop').length,
    topQueries,
    noResultQueries,
  };
}

export function getAnalyticsStats() {
  initStorage();
  const pageViews = getPageViews();
  const memberViews = getMemberViews();
  const members = getMembers();

  // Calculate top viewed members
  const memberCountMap: Record<number, { id: number; name: string; views: number }> = {};
  for (const mv of memberViews) {
    if (!mv.member_id) continue;
    if (!memberCountMap[mv.member_id]) {
      const m = members.find(x => x.id === mv.member_id);
      memberCountMap[mv.member_id] = {
        id: mv.member_id,
        name: mv.member_name || m?.name || `Member #${mv.member_id}`,
        views: 0,
      };
    }
    memberCountMap[mv.member_id].views += 1;
  }

  const topViewedMembers = Object.values(memberCountMap)
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  return {
    totalPageViews: pageViews.length,
    totalMemberViews: memberViews.length,
    totalSearches: getSearchViews().length,
    topViewedMembers,
  };
}
