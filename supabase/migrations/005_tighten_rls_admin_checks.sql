-- =============================================================================
-- CSE Archive — migration 005: real admin enforcement in RLS
--
-- WHY
-- Migration 003 granted every INSERT/UPDATE/DELETE on `cse_archive_members`
-- to any signed-in user (`to authenticated using (true)`), and migration 002
-- let any signed-in user read and update every join request. The comment in
-- 003 admitted this was only gated by "the app's admin UI".
--
-- That is not a gate. The Supabase anon key ships in the public bundle, so
-- anyone could skip the UI entirely and issue the same REST calls directly:
--
--   curl "$VITE_SUPABASE_URL/rest/v1/cse_archive_members?approval_status=eq.approved" \
--        -H "apikey: $VITE_SUPABASE_ANON_KEY" -X PATCH ... -H "Authorization: Bearer <any user jwt>"
--
-- because signing up for an account is free and unverified. So: any random
-- person could approve their own pending alumni record, delete members, or
-- read other people's applications.
--
-- The fix is to derive admin status from `cse_archive_admin_users`, which
-- migration 004 put in Postgres. The browser now cannot grant itself a role.
--
-- Run this ONCE in the Supabase SQL Editor, AFTER 004.
-- Safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The single source of truth for "is this caller an admin".
--
-- SECURITY DEFINER is required: this function reads the roster table, and RLS
-- on that table would otherwise apply recursively while the policy that calls
-- this function is being evaluated.
--
-- search_path is pinned to the empty string and every object is schema-
-- qualified. That is stronger than pinning to `public`, because it means no
-- schema at all is searched — a caller cannot shadow `auth.jwt()` or the table
-- with a temporary object.
--
-- Read by the JWT email, never by a client-supplied column.
-- -----------------------------------------------------------------------------
create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cse_archive_admin_users a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and a.status = 'active'
  );
$$;

revoke execute on function public.is_active_admin() from public;
grant execute on function public.is_active_admin() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. cse_archive_members — writes now require a real admin.
--
-- Reads stay as they were: the public sees only approved+visible rows, and any
-- signed-in user can read all rows. That is needed so the admin console can
-- review pending applications from the browser.
-- -----------------------------------------------------------------------------
alter table public.cse_archive_members enable row level security;

-- Public read: approved and visible only. (Re-asserted so this file is the
-- authoritative definition even if 003 was edited or only partly applied.)
drop policy if exists "public can read approved members"
  on public.cse_archive_members;
create policy "public can read approved members"
  on public.cse_archive_members
  for select
  to anon, authenticated
  using (approval_status = 'approved' and visible = true);

drop policy if exists "signed in users can read all members"
  on public.cse_archive_members;
create policy "signed in users can read all members"
  on public.cse_archive_members
  for select
  to authenticated
  using (true);

-- Admin-only writes.
drop policy if exists "admins can insert members"
  on public.cse_archive_members;
create policy "admins can insert members"
  on public.cse_archive_members
  for insert
  to authenticated
  with check (public.is_active_admin());

drop policy if exists "admins can update members"
  on public.cse_archive_members;
create policy "admins can update members"
  on public.cse_archive_members
  for update
  to authenticated
  using (public.is_active_admin())
  with check (public.is_active_admin());

drop policy if exists "admins can delete members"
  on public.cse_archive_members;
create policy "admins can delete members"
  on public.cse_archive_members
  for delete
  to authenticated
  using (public.is_active_admin());

-- -----------------------------------------------------------------------------
-- 3. cse_archive_join_requests — applicants may post, nobody but admins may read.
--
-- Previously "signed in users can read join requests" used
-- `auth.uid() is not null`, so ANY signed-in applicant could read every
-- pending application in the archive — full names, emails, phone numbers and
-- department of people who had merely applied.
-- -----------------------------------------------------------------------------
alter table public.cse_archive_join_requests enable row level security;

-- Anyone may submit an application. This must stay open: an applicant has no
-- account yet by definition. Abuse here is bounded by the OTP that
-- `verifyJoinOtp` requires before the app will POST the row, and by the unique
-- index on pending email from migration 002.
drop policy if exists "anyone can submit a join request"
  on public.cse_archive_join_requests;
create policy "anyone can submit a join request"
  on public.cse_archive_join_requests
  for insert
  to anon, authenticated
  with check (true);

-- Reading the queue is admin-only.
drop policy if exists "signed in users can read join requests"
  on public.cse_archive_join_requests;
create policy "admins can read join requests"
  on public.cse_archive_join_requests
  for select
  to authenticated
  using (public.is_active_admin());

-- Applicants may not edit or withdraw rows server-side; only admins may
-- approve, reject or annotate.
drop policy if exists "signed in users can update join requests"
  on public.cse_archive_join_requests;
create policy "admins can update join requests"
  on public.cse_archive_join_requests
  for update
  to authenticated
  using (public.is_active_admin())
  with check (public.is_active_admin());

drop policy if exists "signed in users can delete join requests"
  on public.cse_archive_join_requests;
create policy "admins can delete join requests"
  on public.cse_archive_join_requests
  for delete
  to authenticated
  using (public.is_active_admin());

-- -----------------------------------------------------------------------------
-- 4. cse_archive_admin_users — the roster itself.
--
-- Reads stay open (the client needs it to decide whether to render the
-- console). There are still no INSERT/UPDATE/DELETE policies, so the anon key
-- cannot modify the roster. Admin changes go through the serverless function
-- pattern used by `api/photo-upload`.
-- -----------------------------------------------------------------------------
alter table public.cse_archive_admin_users enable row level security;

drop policy if exists "anyone can read admin roster"
  on public.cse_archive_admin_users;
create policy "anyone can read admin roster"
  on public.cse_archive_admin_users
  for select
  to anon, authenticated
  using (true);

-- Belt and braces: even if someone later adds a permissive policy by mistake,
-- a non-admin must not be able to grant themselves a role.
--
-- This runs as the invoker (no SECURITY DEFINER) and simply delegates to
-- is_active_admin(), which is itself SECURITY DEFINER.
--
-- Note on the no-JWT branch below. RLS is the real gate here: this table has
-- no INSERT/UPDATE/DELETE policy, so an anon-key request never reaches the
-- trigger at all. When there is no JWT email the call is not coming through
-- PostgREST as a user — it is the SQL editor, a service-role call, or a
-- migration. Those already bypass RLS as the table owner, so refusing them
-- would only make migrations 004 and 005 impossible to re-run. The guard is
-- strictly defence in depth for the case where a policy is added by mistake.
create or replace function public.guard_admin_roster_writes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  caller_email text := auth.jwt() ->> 'email';
begin
  -- Not a PostgREST user request; RLS already governs it.
  if nullif(caller_email, '') is null then
    return coalesce(new, old);
  end if;

  if public.is_active_admin() then
    return new;
  end if;

  raise exception 'Only an active administrator can modify the admin roster'
    using errcode = '42501';
end;
$$;

drop trigger if exists cse_archive_admin_users_write_guard
  on public.cse_archive_admin_users;
create trigger cse_archive_admin_users_write_guard
  before insert or update or delete on public.cse_archive_admin_users
  for each row
  execute function public.guard_admin_roster_writes();

-- -----------------------------------------------------------------------------
-- 5. Confirm.
--
--   -- should be true
--   select public.is_active_admin();
--
--   -- should list 0 policies (RLS is not per-table visible this way; instead)
--   select tablename, policyname, cmd, roles from pg_policies
--    where schemaname = 'public'
--      and tablename in ('cse_archive_members','cse_archive_join_requests',
--                        'cse_archive_admin_users')
--    order by tablename, cmd, policyname;
--
-- Expect on cse_archive_members: 2 select policies, and insert/update/delete
-- policies that all reference public.is_active_admin().
-- On cse_archive_join_requests: insert open to anon, everything else admin-only.
-- -----------------------------------------------------------------------------

notify pgrst, 'reload schema';
