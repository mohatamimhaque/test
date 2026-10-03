/**
 * Administrator roster management.
 *
 * WHY THIS EXISTS
 * Migration 004 moved the admin roster into Postgres and deliberately granted
 * NO write policies to the browser, because with the anon key shipped in the
 * bundle anyone could have added themselves as an administrator.
 *
 * That is the right trade, but it left the "Admin manager" tab unable to save:
 * `addAdminUser()` and `toggleAdminStatus()` in src/lib/storage.ts were still
 * writing straight to the table with the anon key, so every save was silently
 * rejected by RLS and the change vanished on the next refresh.
 *
 * This endpoint performs those two writes server-side, after re-checking the
 * caller's session against the roster itself.
 *
 * Auth: ADMIN ONLY. Only an existing active admin may call it, and only a
 * `super_admin` may change roles or re-enable accounts (see below).
 *
 * Requires SUPABASE_URL and SUPABASE_ANON_KEY in the server environment.
 */

import { getSessionEmail, isActiveAdmin, sendError, SUPABASE_URL, SUPABASE_ANON_KEY } from './_shared.js';

const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const ROLES = ['admin', 'super_admin'];
const STATUSES = ['active', 'disabled'];

const ADMIN_LIST_COLUMNS = 'id,email,role,status,created_by,created_at,updated_at';

/** Strips the `Bearer ` prefix so the raw JWT can be forwarded to PostgREST. */
function rawToken(authHeader) {
  return String(authHeader || '').replace(/^Bearer\s+/i, '').trim();
}

/** Reads the full roster using the caller's token. Returns [] on any failure. */
async function listRoster(authHeader) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/cse_archive_admin_users?select=${ADMIN_LIST_COLUMNS}&limit=100`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${rawToken(authHeader)}` } }
    );
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/** The caller's own roster row, or null if they are not on it. */
async function getCallerRow(authHeader) {
  const email = await getSessionEmail(authHeader);
  if (!email) return null;
  const rows = await listRoster(authHeader);
  return rows.find((r) => String(r?.email || '').toLowerCase().trim() === email) || null;
}

/**
 * Writes through the Supabase REST API using the caller's own token.
 *
 * Migration 005 adds a BEFORE trigger that raises unless `is_active_admin()` is
 * true, so these writes are rejected for anyone who is not already an admin.
 * That is the enforcement point; this function only supplies credentials.
 */
async function rosterWrite(authHeader, path, method, body, prefer) {
  const token = rawToken(authHeader);
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: prefer
        ? `return=representation,resolution=${prefer}`
        : 'return=representation',
    },
    body: JSON.stringify(body),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendError(res, 405, 'Method not allowed');
  }

  if (!supabaseConfigured) {
    return res.status(503).json({
      error: 'Database is not configured',
      hint: 'Set SUPABASE_URL and SUPABASE_ANON_KEY on the server.',
    });
  }

  const authHeader = req.headers?.authorization;
  if (!(await isActiveAdmin(authHeader))) {
    return sendError(res, 403, 'Administrator access required');
  }

  const action = String(req.body?.action || '').trim();
  const caller = await getCallerRow(authHeader);

  // ---------------------------------------------------------------- add admin
  if (action === 'add') {
    const email = String(req.body?.email || '').toLowerCase().trim();
    const role = String(req.body?.role || 'admin');

    if (!email || !email.includes('@')) {
      return sendError(res, 400, 'Enter a valid email address.');
    }
    if (!ROLES.includes(role)) {
      return sendError(res, 400, 'Role must be admin or super_admin.');
    }
    // Only a super admin may mint another super admin; otherwise an ordinary
    // admin could escalate a colleague and then use that account.
    if (role === 'super_admin' && caller?.role !== 'super_admin') {
      return sendError(res, 403, 'Only a super administrator can create a super administrator.');
    }

    const id = 'admin-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    const rows = await listRoster(authHeader);
    const current = rows.find((r) => String(r?.email || '').toLowerCase().trim() === email) || null;

    // Re-enabling a disabled account, or changing an existing role, is an
    // escalation path too — hold it to the same super-admin bar.
    if (current && (current.status === 'disabled' || current.role !== role) && caller?.role !== 'super_admin') {
      return sendError(res, 403, 'Only a super administrator can change an existing administrator.');
    }

    const payload = {
      id: current?.id || id,
      email,
      role,
      status: 'active',
      created_by: current?.created_by || caller?.email || null,
    };

    // PostgREST needs `Prefer: resolution=merge-duplicates` for POST to behave
    // as an upsert; a bare POST against an existing primary key returns 409.
    // Re-adding an existing admin is a normal action in the Admin manager.
    const write = await rosterWrite(authHeader, 'cse_archive_admin_users', 'POST', payload, {
      resolution: 'merge-duplicates',
    });
    if (!write.ok) {
      const detail = await write.text().catch(() => '');
      console.error('Failed to upsert admin:', write.status, detail);
      return sendError(res, 502, 'The administrator roster could not be updated.');
    }

    const saved = await write.json().catch(() => []);
    return res.status(200).json({ admin: Array.isArray(saved) ? saved[0] || payload : payload });
  }

  // ------------------------------------------------------------- toggle status
  if (action === 'set_status') {
    const id = String(req.body?.id || '').trim();
    const status = String(req.body?.status || '');

    if (!id) return sendError(res, 400, 'Missing administrator id.');
    if (!STATUSES.includes(status)) return sendError(res, 400, 'Status must be active or disabled.');

    // Locking yourself out is unrecoverable through the UI: the roster has no
    // self-service, so refuse to disable the last active super administrator.
    const roster = await listRoster(authHeader);
    const target = roster.find((r) => r.id === id) || null;
    if (!target) return sendError(res, 404, 'That administrator no longer exists.');

    if (target.status === 'active' && status === 'disabled' && target.role === 'super_admin') {
      const otherActiveSupers = roster.filter(
        (r) => r.role === 'super_admin' && r.status === 'active' && r.id !== id
      );
      if (otherActiveSupers.length === 0) {
        return sendError(res, 400, 'This is the only active super administrator and cannot be disabled.');
      }
    }

    const write = await rosterWrite(
      authHeader,
      `cse_archive_admin_users?id=eq.${encodeURIComponent(id)}`,
      'PATCH',
      { status }
    );
    if (!write.ok) {
      const detail = await write.text().catch(() => '');
      console.error('Failed to set admin status:', write.status, detail);
      return sendError(res, 502, 'The administrator status could not be updated.');
    }

    return res.status(200).json({ id, status });
  }

  return sendError(res, 400, 'Unknown action.');
}