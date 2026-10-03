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
