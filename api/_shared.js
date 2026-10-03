/**
 * Shared helpers for the serverless functions in this directory.
 *
 * The leading underscore keeps Vercel from treating this file as its own
 * endpoint: anything in `api/` that is not underscore-prefixed becomes a route.
 */

export const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * Resolves the caller's email from their Supabase session.
 *
 * Returns null when there is no usable token, when the token is expired, or
 * when Supabase is unreachable. Never trusts a body or query field for
 * identity: only the signed session is accepted.
 */
export async function getSessionEmail(authHeader) {
  if (!supabaseConfigured) return null;

  const token = String(authHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;

    const user = await res.json();
    const email = String(user?.email || '').toLowerCase().trim();
    return email || null;
  } catch {
    return null;
  }
}

/**
 * Confirms the caller is an active administrator.
 *
 * The admin roster lives in Postgres (`cse_archive_admin_users`), which a
 * visitor cannot edit from the browser — unlike the previous localStorage copy.
 *
 * Fails closed: if Supabase is not configured, the token is missing/invalid, or
 * the roster cannot be read, this returns false rather than assuming access.
 */
export async function isActiveAdmin(authHeader) {
  if (!supabaseConfigured) return false;

  const email = await getSessionEmail(authHeader);
  if (!email) return false;

  try {
    const token = String(authHeader).replace(/^Bearer\s+/i, '').trim();
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/cse_archive_admin_users` +
        `?select=email,role,status&email=eq.${encodeURIComponent(email)}&limit=1`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return false;

    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    return Boolean(row && row.status === 'active');
  } catch {
    return false;
  }
}

/** Sends a JSON error response. Returns the response so callers can `return`. */
export function sendError(res, status, message) {
  res.status(status).json({ error: message });
  return res;
}