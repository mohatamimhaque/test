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
-- =============================================================================
-- CSE Archive — migration 004: administrator roster in Postgres
--
-- WHY
-- The admin list used to live only in each browser's localStorage under
-- `cse_archive_admin_users_v1`, and `getAdminByEmail()` additionally hardcoded
-- a super-admin identity. That meant anyone could open DevTools, edit the
-- localStorage array, and be granted the full admin console — including
-- approving join requests and deleting members.
--
-- Moving the roster into Postgres makes it server-controlled: a visitor cannot
-- edit it from the browser. This is the identity that `/api/photo-upload`
-- checks before accepting an upload.
--
-- Run this ONCE in the Supabase SQL Editor.
-- Safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The roster.
-- -----------------------------------------------------------------------------
create table if not exists public.cse_archive_admin_users (
  id          text primary key,
  email       text        not null unique,
  role        text        not null default 'admin',
  status      text        not null default 'active',
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint cse_archive_admin_users_role_chk
    check (role in ('admin', 'super_admin')),
  constraint cse_archive_admin_users_status_chk
    check (status in ('active', 'disabled'))
);

-- Lower-cased email for case-insensitive lookups.
create index if not exists cse_archive_admin_users_email_idx
  on public.cse_archive_admin_users (lower(email));

-- Only active admins can act, so index that partial view for the hot path.
create index if not exists cse_archive_admin_users_active_idx
  on public.cse_archive_admin_users (lower(email))
  where status = 'active';

-- -----------------------------------------------------------------------------
-- 2. Seed the existing super administrator.
--
-- The hardcoded identity in AuthContext is being removed, so this row is what
-- keeps the current administrator able to sign in.
-- -----------------------------------------------------------------------------
insert into public.cse_archive_admin_users (id, email, role, status)
values ('admin-super-mohatamim', 'mohatamimhaque@outlook.com', 'super_admin', 'active')
on conflict (email) do update
  set role    = excluded.role,
      status  = excluded.status,
      updated_at = now();

-- -----------------------------------------------------------------------------
-- 3. updated_at trigger.
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cse_archive_admin_users_touch on public.cse_archive_admin_users;
create trigger cse_archive_admin_users_touch
  before update on public.cse_archive_admin_users
  for each row
  execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 4. RLS.
--
-- Reads are open: the admin roster is not sensitive, and the client needs it to
-- decide whether to render the console. Writes are REFUSED for everyone.
--
-- Admin changes go through a server function so the decision cannot be forged
-- from the browser with the anon key. The `api/photo-upload` function is
-- already an example of that pattern: it checks this table using the caller's
-- real Supabase session rather than trusting a client-side flag.
-- -----------------------------------------------------------------------------
alter table public.cse_archive_admin_users enable row level security;

drop policy if exists "anyone can read admin roster"
  on public.cse_archive_admin_users;
create policy "anyone can read admin roster"
  on public.cse_archive_admin_users
  for select
  to anon, authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- 5. Confirm.
--
--   select email, role, status from cse_archive_admin_users;
--
-- Expect one row: mohatamimhaque@outlook.com | super_admin | active
-- -----------------------------------------------------------------------------

notify pgrst, 'reload schema';
-- =============================================================================
-- CSE Archive — migration 003: repair the members table
--
-- Companion to 002. The live `cse_archive_members` table is missing every
-- column the approval workflow added:
--
--   approval_status, reviewed_by, reviewed_at, rejection_reason
--
-- Consequence: every admin write fails. `updateMember` and `createMember`
-- both send `approval_status`, so PostgREST rejects the whole statement with
--
--   PGRST204  Could not find the 'approval_status' column of
--             'cse_archive_members' in the schema cache
--
-- 001 used `add column if not exists`, which SHOULD have been safe — but the
-- live table shows none of the four, so that section of 001 never ran against
-- this database (it was likely never executed, or it errored part-way and was
-- discarded). This migration adds them explicitly and verifies the result.
--
-- Run this ONCE in the Supabase SQL Editor (Dashboard → SQL → New query).
-- Order matters: run 002 and 003 together.
-- Safe to re-run: every statement is guarded.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The approval workflow columns.
-- -----------------------------------------------------------------------------
alter table public.cse_archive_members
  add column if not exists approval_status   text not null default 'approved';
alter table public.cse_archive_members
  add column if not exists reviewed_by       text;
alter table public.cse_archive_members
  add column if not exists reviewed_at       timestamptz;
alter table public.cse_archive_members
  add column if not exists rejection_reason  text;
alter table public.cse_archive_members
  add column if not exists auth_user_id      uuid;

-- -----------------------------------------------------------------------------
-- 2. Legacy rows carry no status, so the default above marks all 923 of them
--    'approved' — exactly how the public site behaved before the workflow
--    existed. Normalise any stray values the CHECK below would reject.
-- -----------------------------------------------------------------------------
update public.cse_archive_members
   set approval_status = 'approved'
 where approval_status is null
    or approval_status not in ('approved', 'pending', 'rejected');

-- -----------------------------------------------------------------------------
-- 3. Status CHECK constraint.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cse_archive_members_approval_status_chk'
      and conrelid = 'public.cse_archive_members'::regclass
  ) then
    alter table public.cse_archive_members
      add constraint cse_archive_members_approval_status_chk
      check (approval_status in ('approved', 'pending', 'rejected'));
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 4. Index used by the public directory query.
-- -----------------------------------------------------------------------------
create index if not exists cse_archive_members_approval_status_idx
  on public.cse_archive_members (approval_status);

-- -----------------------------------------------------------------------------
-- 5. updated_at trigger.
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cse_archive_members_touch on public.cse_archive_members;
create trigger cse_archive_members_touch
  before update on public.cse_archive_members
  for each row
  execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 6. RLS for the members table.
--
-- The frontend uses the ANON key, so without policies every request is
-- rejected. Public browsing needs to READ approved + visible rows. Writes are
-- admin-only, but the app identifies admins in localStorage rather than via a
-- Postgres role, so there is no trustworthy server-side identity to gate on.
--
-- `cse_archive_admin_users` is the intended source of truth for that. Until it
-- is synced to Postgres, the write policies below are permissive and the real
-- gate remains the app's admin UI. Tighten these once an admin role exists —
-- see the note in README under Security.
-- -----------------------------------------------------------------------------
alter table public.cse_archive_members enable row level security;

-- Public read: only approved and visible rows.
drop policy if exists "public can read approved members"
  on public.cse_archive_members;
create policy "public can read approved members"
  on public.cse_archive_members
  for select
  to anon, authenticated
  using (approval_status = 'approved' and visible = true);

-- Admin read: signed-in users see every row, including pending/rejected.
-- The app merges this with any locally staged rows.
drop policy if exists "signed in users can read all members"
  on public.cse_archive_members;
create policy "signed in users can read all members"
  on public.cse_archive_members
  for select
  to authenticated
  using (true);

drop policy if exists "admins can insert members"
  on public.cse_archive_members;
create policy "admins can insert members"
  on public.cse_archive_members
  for insert
  to authenticated
  with check (true);

drop policy if exists "admins can update members"
  on public.cse_archive_members;
create policy "admins can update members"
  on public.cse_archive_members
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "admins can delete members"
  on public.cse_archive_members;
create policy "admins can delete members"
  on public.cse_archive_members
  for delete
  to authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- 7. Refresh PostgREST's schema cache so PGRST204 clears immediately.
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- Verify:
--
--   select column_name from information_schema.columns
--    where table_name = 'cse_archive_members'
--    order by ordinal_position;
--
--   select approval_status, count(*) from cse_archive_members group by 1;
--
-- Expect 'approved | 923'.
-- -----------------------------------------------------------------------------
-- =============================================================================
-- CSE Archive — migration 002: repair the join-request staging table
--
-- WHY THIS IS NEEDED
-- 001 created `cse_archive_join_requests` with `create table if not exists`.
-- On any database where that table already existed (created by hand, or by an
-- earlier partial run of 001), the statement is a NO-OP: Postgres skips it
-- entirely and never adds the later columns. The result is a table that is
-- missing `auth_user_id` and `email_verified`.
--
-- The app always inserts both fields, so every join-request submission fails
-- with:
--
--   PGRST204  Could not find the 'email_verified' column of
--             'cse_archive_join_requests' in the schema cache
--
-- `submitJoinRequest` catches that error and falls back to localStorage, so
-- applicants see "Request saved, but the server could not be reached" and the
-- request is NEVER visible to an admin. Running 001 again does not fix it,
-- because the `create table if not exists` guard skips the whole definition.
--
-- This migration adds the missing columns explicitly and independently of how
-- the table came into being.
--
-- Run this ONCE in the Supabase SQL Editor (Dashboard → SQL → New query).
-- Safe to re-run: every statement is guarded and idempotent.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The two columns the app inserts but the table does not have.
-- -----------------------------------------------------------------------------
alter table public.cse_archive_join_requests
  add column if not exists auth_user_id   uuid;
alter table public.cse_archive_join_requests
  add column if not exists email_verified boolean not null default false;

-- -----------------------------------------------------------------------------
-- 2. Audit columns, in case the table predates them as well.
-- -----------------------------------------------------------------------------
alter table public.cse_archive_join_requests
  add column if not exists rejection_reason text;
alter table public.cse_archive_join_requests
  add column if not exists reviewed_by      text;
alter table public.cse_archive_join_requests
  add column if not exists reviewed_at      timestamptz;
alter table public.cse_archive_join_requests
  add column if not exists created_at       timestamptz not null default now();
alter table public.cse_archive_join_requests
  add column if not exists updated_at       timestamptz not null default now();

-- -----------------------------------------------------------------------------
-- 3. The status CHECK constraint. Named constraints cannot be added with
--    `if not exists`, so test for it first.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cse_archive_join_requests_status_chk'
      and conrelid = 'public.cse_archive_join_requests'::regclass
  ) then
    -- Normalise any unexpected legacy value before constraining.
    update public.cse_archive_join_requests
      set status = 'pending'
      where status is null or status not in ('pending', 'approved', 'rejected');

    alter table public.cse_archive_join_requests
      add constraint cse_archive_join_requests_status_chk
      check (status in ('pending', 'approved', 'rejected'));
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 4. Indexes the admin queue relies on.
-- -----------------------------------------------------------------------------
create index if not exists cse_archive_join_requests_status_idx
  on public.cse_archive_join_requests (status);

create index if not exists cse_archive_join_requests_email_idx
  on public.cse_archive_join_requests (lower(email));

-- Blocks two in-flight requests from the same address. Any duplicates already
-- present are collapsed to the most recent row first, otherwise this fails.
with ranked as (
  select id,
         row_number() over (
           partition by lower(email)
           order by created_at desc nulls last, id desc
         ) as rn
  from public.cse_archive_join_requests
  where status = 'pending'
)
delete from public.cse_archive_join_requests
where id in (select id from ranked where rn > 1);

create unique index if not exists cse_archive_join_requests_pending_email_uniq
  on public.cse_archive_join_requests (lower(email))
  where status = 'pending';

-- -----------------------------------------------------------------------------
-- 5. updated_at trigger.
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cse_archive_join_requests_touch
  on public.cse_archive_join_requests;
create trigger cse_archive_join_requests_touch
  before update on public.cse_archive_join_requests
  for each row
  execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 6. RLS. The anon INSERT policy is what lets an unauthenticated applicant
--    submit a request; without it PostgREST returns 401/403.
-- -----------------------------------------------------------------------------
alter table public.cse_archive_join_requests enable row level security;

drop policy if exists "anyone can submit a join request"
  on public.cse_archive_join_requests;
create policy "anyone can submit a join request"
  on public.cse_archive_join_requests
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "signed in users can read join requests"
  on public.cse_archive_join_requests;
create policy "signed in users can read join requests"
  on public.cse_archive_join_requests
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists "signed in users can update join requests"
  on public.cse_archive_join_requests;
create policy "signed in users can update join requests"
  on public.cse_archive_join_requests
  for update
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- -----------------------------------------------------------------------------
-- 7. Tell PostgREST to reload its schema cache, otherwise it can keep serving
--    the stale column list and the PGRST204 error persists. `NOTIFY pgrst` is
--    the supported way to do this; hosted Supabase also auto-detects DDL, so
--    this is only a safety net.
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- Done. Verify with:
--
--   select column_name, data_type
--   from information_schema.columns
--   where table_name = 'cse_archive_join_requests'
--   order by ordinal_position;
--
-- `auth_user_id` and `email_verified` must both appear.
-- -----------------------------------------------------------------------------
