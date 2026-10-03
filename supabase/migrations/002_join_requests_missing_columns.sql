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
