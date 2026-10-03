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
