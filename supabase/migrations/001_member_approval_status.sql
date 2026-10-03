-- =============================================================================
-- CSE Archive — Join Request / Approval workflow migration
--
-- Run this ONCE in the Supabase SQL Editor (Dashboard → SQL → New query).
-- There is no migration tooling in this repo, so the schema lives only in the
-- live database.
--
-- What it does:
--   1. Adds the `approval_status` column to `cse_archive_members`.
--   2. Backfills every existing (legacy) record to 'approved' so the public
--      site behaves exactly as before.
--   3. Adds a few nullable audit columns (reviewed_by / reviewed_at /
--      rejection_reason) used by the admin approve/reject UI.
--   5. Creates a dedicated `cse_archive_join_requests` staging table.
--
-- Safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Members table: add the approval column
-- -----------------------------------------------------------------------------
alter table public.cse_archive_members
  add column if not exists approval_status text
    default 'approved'
    not null;

-- -----------------------------------------------------------------------------
-- 2. Backfill legacy rows. Important: a DEFAULT of 'approved' already covers
--    rows that existed before the column was added, but this statement also
--    fixes any rows explicitly set to NULL by an earlier partial run.
-- -----------------------------------------------------------------------------
update public.cse_archive_members
   set approval_status = 'approved'
 where approval_status is null
    or approval_status not in ('approved', 'pending', 'rejected');

-- -----------------------------------------------------------------------------
-- 3. Constraint so the app can only ever write a known state.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cse_archive_members_approval_status_chk'
  ) then
    alter table public.cse_archive_members
      add constraint cse_archive_members_approval_status_chk
      check (approval_status in ('approved', 'pending', 'rejected'));
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 4. Admin review audit columns.
-- -----------------------------------------------------------------------------
alter table public.cse_archive_members
  add column if not exists reviewed_by      text,
  add column if not exists reviewed_at      timestamptz,
  add column if not exists rejection_reason text;

-- -----------------------------------------------------------------------------
-- 5. Index used by the public directory query
--    (`.eq('approval_status', 'approved').eq('visible', true)`).
-- -----------------------------------------------------------------------------
create index if not exists cse_archive_members_approval_status_idx
  on public.cse_archive_members (approval_status);

-- =============================================================================
-- 6. Join request staging table.
--
-- Requests are written here BEFORE admin approval. On approval the row is
-- promoted into `cse_archive_members` with approval_status = 'approved'
-- (handled by the app's `approveJoinRequest`).
-- =============================================================================
create table if not exists public.cse_archive_join_requests (
  id                bigint generated always as identity primary key,
  auth_user_id      uuid,
  email             text        not null,
  email_verified    boolean     not null default false,
  name              text        not null,
  mobile            text,
  student_id        text,
  blood             text,
  designation       text,
  organization      text,
  location          text,
  photo_key         text,
  photo_url         text,
  status            text        not null default 'pending',
  rejection_reason  text,
  reviewed_by       text,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint cse_archive_join_requests_status_chk
    check (status in ('pending', 'approved', 'rejected'))
);

create index if not exists cse_archive_join_requests_status_idx
  on public.cse_archive_join_requests (status);

create index if not exists cse_archive_join_requests_email_idx
  on public.cse_archive_join_requests (lower(email));

-- Prevent duplicate in-flight requests from the same address.
create unique index if not exists cse_archive_join_requests_pending_email_uniq
  on public.cse_archive_join_requests (lower(email))
  where status = 'pending';

-- Keep updated_at honest.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cse_archive_join_requests_touch on public.cse_archive_join_requests;
create trigger cse_archive_join_requests_touch
  before update on public.cse_archive_join_requests
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- 7. Row Level Security
--
-- The frontend talks to Supabase with the ANON key, so without policies every
-- request is rejected. These policies match the app's access model:
-- anyone may submit a join request, but only signed-in users may read them.
-- Adjust `auth.uid() IS NOT NULL` to your admin table if you later sync
-- `cse_archive_admin_users` to Postgres.
-- =============================================================================
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

-- The members table is already in use; make sure it stays readable by anon
-- (the public directory needs it). If these policies already exist the drops
-- are harmless no-ops.
drop policy if exists "public can read members"
  on public.cse_archive_members;
create policy "public can read members"
  on public.cse_archive_members
  for select
  to anon, authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- Verification query — expect every row to read 'approved'.
-- -----------------------------------------------------------------------------
-- select approval_status, count(*) from public.cse_archive_members group by 1;