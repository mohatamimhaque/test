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
--
-- IMPORTANT: this table ALREADY EXISTS on the live database, created by hand
-- with a different shape than an earlier draft of this file assumed:
--
--   id        uuid primary key default gen_random_uuid()   <- not text!
--   user_id   uuid
--   email     text
--   role      text
--   status    text
--   ...
--
-- That mismatch is why seeding with a readable id like
-- 'admin-super-mohatamim' fails:
--
--   ERROR 22P02: invalid input syntax for type uuid: "admin-super-mohatamim"
--
-- `create table if not exists` is a no-op when the table is present, so the
-- declared type below is only used on a genuinely fresh database. On the live
-- one the existing uuid column is kept and reconciled by the ALTERs that follow.
--
-- Every statement below is written to be safe in both cases.
-- -----------------------------------------------------------------------------
create table if not exists public.cse_archive_admin_users (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid,
  email       text        not null unique,
  role        text        not null default 'admin',
  status      text        not null default 'active',
  -- uuid, NOT text: on the live table this references a Supabase Auth user id.
  -- Writing a readable label here fails with 22P02.
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint cse_archive_admin_users_role_chk
    check (role in ('admin', 'super_admin')),
  constraint cse_archive_admin_users_status_chk
    check (status in ('active', 'disabled'))
);

-- Reconcile a pre-existing table that lacks these columns. A fresh database
-- already has them, so this is a no-op there.
alter table public.cse_archive_admin_users add column if not exists user_id    uuid;
alter table public.cse_archive_admin_users add column if not exists created_by uuid;
alter table public.cse_archive_admin_users add column if not exists created_at timestamptz not null default now();
alter table public.cse_archive_admin_users add column if not exists updated_at timestamptz not null default now();

-- The CHECK constraints are named, and named constraints cannot be added with
-- `if not exists`, so test for each one first. Legacy rows may hold values the
-- constraint would reject, so normalise before constraining.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cse_archive_admin_users_role_chk'
      and conrelid = 'public.cse_archive_admin_users'::regclass
  ) then
    update public.cse_archive_admin_users
       set role = 'admin'
     where role is null or role not in ('admin', 'super_admin');

    alter table public.cse_archive_admin_users
      add constraint cse_archive_admin_users_role_chk
      check (role in ('admin', 'super_admin'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'cse_archive_admin_users_status_chk'
      and conrelid = 'public.cse_archive_admin_users'::regclass
  ) then
    update public.cse_archive_admin_users
       set status = 'active'
     where status is null or status not in ('active', 'disabled');

    alter table public.cse_archive_admin_users
      add constraint cse_archive_admin_users_status_chk
      check (status in ('active', 'disabled'));
  end if;
end
$$;

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
--
-- The id is OMITTED on purpose. `id` is a uuid, so a readable value like
-- 'admin-super-mohatamim' is rejected with 22P02. Letting the column default
-- generate one also means this file no longer hardcodes anything about a
-- specific person's identity beyond the email already in the repository.
--
-- The conflict target is `email`, which is UNIQUE on both the live table and
-- the definition above, so re-running this never creates a duplicate.
-- -----------------------------------------------------------------------------
insert into public.cse_archive_admin_users (email, role, status)
values ('mohatamimhaque@outlook.com', 'super_admin', 'active')
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
-- decide whether to render the console. Writes must be REFUSED for the anon
-- key.
--
-- CRITICAL: this section must also DROP any write policy that already exists on
-- the live table, not just decline to create one. The live database carries
-- permissive INSERT/UPDATE/DELETE policies from an earlier hand-written setup,
-- and RLS policies are additive — leaving them in place means the table stays
-- fully writable by anyone holding the public anon key, which is the entire
-- admin roster. The explicit drops below are what actually close it.
--
-- Verified against the live database before this fix: the anon key could
-- INSERT a super_admin, escalate any existing row to super_admin, re-enable a
-- disabled account, and DELETE rows — full takeover of the admin console.
-- Migration 006 hardens this further.
-- -----------------------------------------------------------------------------
alter table public.cse_archive_admin_users enable row level security;

drop policy if exists "anyone can read admin roster"
  on public.cse_archive_admin_users;
create policy "anyone can read admin roster"
  on public.cse_archive_admin_users
  for select
  to anon, authenticated
  using (true);

-- Remove every write policy regardless of its name, so this works no matter
-- what the earlier policies were called.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename  = 'cse_archive_admin_users'
      and cmd <> 'SELECT'
  loop
    execute format('drop policy if exists %I on public.cse_archive_admin_users', p.policyname);
  end loop;
end
$$;

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
