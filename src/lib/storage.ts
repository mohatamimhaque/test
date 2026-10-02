import { Member, SiteSettings, JoinRequest, AdminUser, AuditLog, PageView, MemberView } from '../types';
import initialMembersRaw from '../data/initialMembers.json';
import initialAnalyticsRaw from '../data/initialAnalytics.json';
import { supabase, isSupabaseConfigured } from './supabase';

const STORAGE_KEYS = {
  MEMBERS: 'cse_archive_members_v1',
  SETTINGS: 'cse_archive_settings_v1',
  JOIN_REQUESTS: 'cse_archive_join_requests_v1',
  ADMIN_USERS: 'cse_archive_admin_users_v1',
  AUDIT_LOGS: 'cse_archive_audit_logs_v1',
  PAGE_VIEWS: 'cse_archive_page_views_v1',
  MEMBER_VIEWS: 'cse_archive_member_views_v1',
};

const DEFAULT_SETTINGS: SiteSettings = {
  id: 1,
  title: 'CSE Archive',
  subtitle: 'Alumni & Directory System',
  header_title: 'Department of Computer Science & Engineering',
  description: 'Official Archive & Member Directory for CSE Alumni, Faculty, and Students.',
  logo_url: '',
  footer_text: '© 2026 Department of Computer Science & Engineering. All rights reserved.',
  contact_email: 'alumni@cse-archive.edu',
  contact_phone: '+880 1700 000000',
  join_enabled: true,
  updated_at: new Date().toISOString(),
};

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
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error saving key ${key}:`, err);
  }
}

// INITIALIZE SEED DATA ONCE
export function initStorage(): void {
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

  if (!localStorage.getItem(STORAGE_KEYS.JOIN_REQUESTS)) {
    setLocal(STORAGE_KEYS.JOIN_REQUESTS, []);
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
}

// MEMBER MANAGEMENT
export function getMembers(): Member[] {
  initStorage();
  return getLocal<Member[]>(STORAGE_KEYS.MEMBERS, []);
}

export function saveMembers(members: Member[]): void {
  setLocal(STORAGE_KEYS.MEMBERS, members);
}

export function getMemberById(id: number): Member | undefined {
  return getMembers().find(m => m.id === id);
}

export function getMemberByEmail(email: string): Member | undefined {
  if (!email) return undefined;
  const cleanEmail = email.toLowerCase().trim();
  const members = getMembers();
  let found = members.find(m => m.email && m.email.toLowerCase().trim() === cleanEmail);

  if (!found) {
    // Check if there is an approved join request for this email
    const requests = getJoinRequests();
    const approvedReq = requests.find(r => r.email && r.email.toLowerCase().trim() === cleanEmail && r.status === 'approved');
    if (approvedReq) {
      const maxId = members.reduce((max, m) => Math.max(max, m.id || 0), 0);
      const nextId = maxId + 1;

      found = {
        id: nextId,
        legacy_id: nextId,
        name: approvedReq.name,
        email: approvedReq.email,
        mobile: approvedReq.mobile,
        student_id: approvedReq.student_id,
        blood: approvedReq.blood,
        designation: approvedReq.designation,
        organization: approvedReq.organization,
        location: approvedReq.location,
        photo_key: approvedReq.photo_key,
        photo_url: approvedReq.photo_url,
        visible: true,
        created_at: approvedReq.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      members.unshift(found);
      saveMembers(members);
    }
  }

  return found;
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

  logAudit({
    actor_email: actorEmail || 'system',
    action: 'member.delete',
    target_type: 'member',
    target_id: String(id),
    details: { name: member?.name, email: member?.email }
  });
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

// JOIN REQUESTS
export async function syncJoinRequestsFromSupabase(): Promise<JoinRequest[]> {
  initStorage();
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('cse_archive_join_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const localReqs = getLocal<JoinRequest[]>(STORAGE_KEYS.JOIN_REQUESTS, []);
        const map = new Map<string, JoinRequest>();

        localReqs.forEach(r => {
          if (r.email) map.set(r.email.toLowerCase().trim(), r);
        });

        data.forEach((r: any) => {
          if (r.email) map.set(r.email.toLowerCase().trim(), r as JoinRequest);
        });

        const merged = Array.from(map.values()).sort((a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );

        setLocal(STORAGE_KEYS.JOIN_REQUESTS, merged);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('join_requests_updated'));
          window.dispatchEvent(new Event('storage'));
        }
        return merged;
      }
    } catch (err) {
      console.error('Error syncing join requests from Supabase:', err);
    }
  }
  return getLocal<JoinRequest[]>(STORAGE_KEYS.JOIN_REQUESTS, []);
}

export function getJoinRequests(): JoinRequest[] {
  initStorage();
  if (isSupabaseConfigured && supabase) {
    syncJoinRequestsFromSupabase().catch(() => {});
  }
  return getLocal<JoinRequest[]>(STORAGE_KEYS.JOIN_REQUESTS, []);
}

export function submitJoinRequest(data: Omit<JoinRequest, 'id' | 'status' | 'created_at' | 'updated_at'>): JoinRequest {
  const requests = getJoinRequests();
  const cleanEmail = (data.email || '').toLowerCase().trim();

  // Check if a request already exists for this email address
  const existingIdx = requests.findIndex(r => r.email && r.email.toLowerCase().trim() === cleanEmail);

  let req: JoinRequest;
  if (existingIdx !== -1) {
    // Update existing request and reset status to pending
    req = {
      ...requests[existingIdx],
      ...data,
      email: cleanEmail,
      status: 'pending',
      updated_at: new Date().toISOString(),
    };
    requests.splice(existingIdx, 1);
    requests.unshift(req);
  } else {
    req = {
      ...data,
      email: cleanEmail,
      id: 'req-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    requests.unshift(req);
  }

  setLocal(STORAGE_KEYS.JOIN_REQUESTS, requests);

  // Sync live to Supabase Database
  if (isSupabaseConfigured && supabase) {
    supabase.from('cse_archive_join_requests').upsert({
      id: req.id,
      name: req.name,
      email: req.email,
      mobile: req.mobile || '',
      student_id: req.student_id || '',
      blood: req.blood || '',
      designation: req.designation || '',
      organization: req.organization || '',
      location: req.location || '',
      photo_key: req.photo_key || '',
      photo_url: req.photo_url || '',
      status: req.status,
      rejection_reason: req.rejection_reason || '',
      created_at: req.created_at,
      updated_at: req.updated_at
    }).then(({ error }) => {
      if (error) console.error('Failed to sync join request to Supabase DB:', error);
    });
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('join_requests_updated'));
    window.dispatchEvent(new Event('storage'));
  }

  logAudit({
    actor_email: req.email,
    action: 'join_request.submit',
    target_type: 'join_request',
    target_id: req.id,
    details: { name: req.name, student_id: req.student_id }
  });

  return req;
}

export function reviewJoinRequest(id: string, status: 'approved' | 'rejected', reviewerEmail: string, rejectionReason?: string): void {
  const requests = getJoinRequests();
  const index = requests.findIndex(r => r.id === id);
  if (index === -1) throw new Error('Join request not found');

  const req = requests[index];
  req.status = status;
  req.reviewed_by = reviewerEmail;
  req.reviewed_at = new Date().toISOString();
  req.rejection_reason = rejectionReason || '';
  req.updated_at = new Date().toISOString();

  requests[index] = req;
  setLocal(STORAGE_KEYS.JOIN_REQUESTS, requests);

  // Sync review decision to Supabase DB
  if (isSupabaseConfigured && supabase) {
    supabase.from('cse_archive_join_requests').update({
      status: req.status,
      reviewed_by: req.reviewed_by,
      reviewed_at: req.reviewed_at,
      rejection_reason: req.rejection_reason || '',
      updated_at: req.updated_at
    }).eq('id', req.id).then(({ error }) => {
      if (error) console.error('Failed to sync review decision to Supabase DB:', error);
    });
  }

  if (status === 'approved') {
    createMember({
      name: req.name,
      email: req.email,
      mobile: req.mobile,
      student_id: req.student_id,
      blood: req.blood,
      designation: req.designation,
      organization: req.organization,
      location: req.location,
      photo_key: req.photo_key,
      photo_url: req.photo_url,
      visible: true,
    }, reviewerEmail);
  }

  logAudit({
    actor_email: reviewerEmail,
    action: `join_request.${status}`,
    target_type: 'join_request',
    target_id: id,
    details: { name: req.name, email: req.email, status, rejectionReason }
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('join_requests_updated'));
    window.dispatchEvent(new Event('storage'));
  }
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
  setLocal(STORAGE_KEYS.AUDIT_LOGS, logs.slice(0, 500)); // Keep recent 500 logs
}

// ANALYTICS TRACKING
export function trackPageView(path: string): void {
  initStorage();
  const views = getLocal<PageView[]>(STORAGE_KEYS.PAGE_VIEWS, []);
  
  const newView: PageView = {
    id: Date.now(),
    path,
    ip_hash: 'beb78c1bbbd0f840',
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/149.0',
    country: 'Bangladesh',
    city: 'Dhaka',
    created_at: new Date().toISOString(),
  };

  views.unshift(newView);
  setLocal(STORAGE_KEYS.PAGE_VIEWS, views.slice(0, 1000));
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
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/132.0',
    country: 'Bangladesh',
    city: 'Dhaka',
    created_at: new Date().toISOString(),
  };

  views.unshift(newView);
  setLocal(STORAGE_KEYS.MEMBER_VIEWS, views.slice(0, 1000));
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
    topViewedMembers,
  };
}
