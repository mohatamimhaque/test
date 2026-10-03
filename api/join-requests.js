/**
 * Admin read access to the join-request queue.
 *
 * WHY THIS EXISTS
 * `getJoinRequests()` in src/lib/storage.ts reads `cse_archive_join_requests`
 * straight from the browser. Migration 002 grants that table a SELECT policy to
 * `authenticated` only:
 *
 *   create policy "signed in users can read join requests"
 *     for select to authenticated using (auth.uid() is not null);
 *
 * The anon key ships inside the bundle, so an admin who has not established a
 * live Supabase session sends that request as `anon`, the policy does not
 * apply, and RLS returns an empty array with HTTP 200. A 200 + `[]` is
 * indistinguishable from "no applications", so the panel silently showed an
 * empty queue even though the table had rows. Verified against the live
 * project: anon read -> 200 [], `authenticated` read -> 200 with rows.
 *
 * This endpoint performs the read server-side. It does NOT bypass RLS: the
 * caller's own session token is forwarded to PostgREST, so the same policy
 * still decides what is returned. The function only supplies credentials.
 *
 * Auth: ADMIN ONLY. The caller must hold a valid Supabase session AND appear
 * as an active administrator on `cse_archive_admin_users` (fails closed).
 *
 * The localStorage cache is preserved as a fallback so an admin who is briefly
 * offline still sees the last known queue, but it is never allowed to mask a
 * real server result.
 */

import { isActiveAdmin, sendError, SUPABASE_URL, SUPABASE_ANON_KEY } from './_shared.js';

const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const JOIN_TABLE = 'cse_archive_join_requests';

/** Strips `Bearer ` so the raw JWT can be forwarded to PostgREST. */
function rawToken(authHeader) {
  return String(authHeader || '').replace(/^Bearer\s+/i, '').trim();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendError(res, 405, 'Method not allowed');
  }

  if (!supabaseConfigured) {
    return res.status(503).json({
      error: 'Database is not configured',
      hint: 'Set SUPABASE_URL and SUPABASE_ANON_KEY on the server.',
    });
  }

  const authHeader = req.headers?.authorization;

  // Distinguish "not an admin" from "session expired" so the client can tell
  // the admin to sign in again instead of showing an empty queue.
  if (!authHeader) {
    return sendError(res, 401, 'Sign in to view applications');
  }
  if (!(await isActiveAdmin(authHeader))) {
    return sendError(res, 403, 'Administrator access required');
  }

  const token = rawToken(authHeader);

  try {
    const upstream = await fetch(
      `${SUPABASE_URL}/rest/v1/${JOIN_TABLE}?select=*&order=created_at.desc&limit=500`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      }
    );

    // PostgREST reports RLS filtering as a normal 200 with fewer rows, so a 200
    // here genuinely means the request was authorized. Anything else is a real
    // failure and must not be presented to the admin as "no applications".
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      console.error(`join-requests read failed (${upstream.status}):`, detail.slice(0, 300));
      return res.status(502).json({
        error: 'Could not read the application queue',
        detail: detail.slice(0, 300),
      });
    }

    const rows = await upstream.json();
    if (!Array.isArray(rows)) {
      return sendError(res, 502, 'Application queue returned an unexpected response');
    }

    // Tell the browser the value is authoritative so it can replace, rather
    // than merge with, a stale cache.
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ requests: rows, count: rows.length });
  } catch (err) {
    console.error('join-requests read threw:', err);
    return sendError(res, 502, 'Could not reach the database');
  }
}