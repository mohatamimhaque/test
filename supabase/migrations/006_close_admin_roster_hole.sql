-- =============================================================================
-- CSE Archive — migration 006: CLOSE the live admin-roster write hole
--
-- READ THIS FIRST — THIS IS URGENT
--
-- Migration 004 originally *intended* to leave `cse_archive_admin_users` with
-- no write policies. It did not achieve that, because RLS policies are
-- ADDITIVE: this file only ever created a SELECT policy and never dropped the
-- permissive INSERT/UPDATE/DELETE policies that were already on the live
-- table from an earlier hand-written setup.
--
-- I verified this against the live database using nothing but the PUBLIC anon
-- key (the one that ships in the JavaScript bundle, visible to every visitor):
--
--   INSERT  a new row with role = 'super_admin'   -> 201 Created
--   PATCH   an existing row to role='super_admin'  -> 204
--   PATCH   a disabled account back to active     -> 204
--   DELETE  any roster row                         -> 204
--
-- That is complete takeover of the admin console by an anonymous visitor:
-- mint yourself a super_admin, then approve or reject alumni applications,
-- edit or delete member records, and upload photos. No account required.
--
-- This migration removes every non-SELECT policy on that table, so the anon key
-- can no longer write to it at all. Roster changes then go exclusively through
-- `/api/admin-roster`, which verifies the caller's Supabase session against
-- this same table before writing.
--
-- Run this ONCE in the Supabase SQL Editor (Dashboard -> SQL -> New query).
-- Safe to re-run. Takes effect immediately; no rebuild needed.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Make sure RLS is on. If a previous setup created the table without
--    enabling it, every policy below would be inert and the table would be
--    world-writable regardless.
-- -----------------------------------------------------------------------------
alter table public.cse_archive_admin_users enable row level security;

-- Also make sure the table owner is not bypassing RLS via FORCE. This matters
-- because PostgREST connects as a role that is typically the table owner in a
-- fresh Supabase project; without FORCE, owner-issued writes skip the policies.
-- FORCE makes the policies apply to the owner too, EXCEPT for superuser and
-- BYPASSRLS roles (which is what the SQL editor uses, so migrations still run).
alter table public.cse_archive_admin_users force row level security;

-- -----------------------------------------------------------------------------
-- 2. Drop every write policy on the roster, whatever it is named.
--
--    Enumerating pg_policies rather than listing names by hand, because the
--    dangerous ones were created outside this repository and their names are
--    not known here.
-- -----------------------------------------------------------------------------
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
    raise notice 'Dropped write policy: %', p.policyname;
  end loop;
end
$$;

-- Belt and braces: also drop the specific names this project has used, in case
-- pg_policies was filtered by permissions in some edge case.
drop policy if exists "anyone can insert admin"      on public.cse_archive_admin_users;
drop policy if exists "anyone can update admin"      on public.cse_archive_admin_users;
drop policy if exists "anyone can delete admin"      on public.cse_archive_admin_users;
drop policy if exists "admins can insert admins"     on public.cse_archive_admin_users;
drop policy if exists "admins can update admins"     on public.cse_archive_admin_users;
drop policy if exists "admins can delete admins"     on public.cse_archive_admin_users;
drop policy if exists "admin_users_insert_policy"    on public.cse_archive_admin_users;
drop policy if exists "admin_users_update_policy"    on public.cse_archive_admin_users;
drop policy if exists "admin_users_delete_policy"    on public.cse_archive_admin_users;
drop policy if exists "authenticated can manage admins" on public.cse_archive_admin_users;

-- -----------------------------------------------------------------------------
-- 3. Re-assert the one policy the client legitimately needs: reading the
--    roster to decide whether to render the admin console.
-- -----------------------------------------------------------------------------
drop policy if exists "anyone can read admin roster"
  on public.cse_archive_admin_users;
create policy "anyone can read admin roster"
  on public.cse_archive_admin_users
  for select
  to anon, authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- 4. Defence in depth: a trigger that refuses roster writes from anyone who is
--    not already an active admin.
--
--    RLS above is the real gate and a non-admin request never reaches this. This
--    exists so that if a permissive policy is ever added again by mistake, the
--    write still fails.
--
--    The no-JWT branch is deliberate: without a JWT email the call is not a
--    PostgREST user request but the SQL editor or a service-role call, both of
--    which are the table owner and need to work for migrations. Refusing them
--    would make this file impossible to re-run.
--
--    is_active_admin() is defined in migration 005. If you have not run 005 yet
--    this trigger will fail to create, so the DO block treats that as
--    non-fatal and continues — RLS from section 2 is already doing the job.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_active_admin'
  ) then
    create or replace function public.guard_admin_roster_writes()
    returns trigger
    language plpgsql
    set search_path = ''
    as $guard$
    declare
      caller_email text := auth.jwt() ->> 'email';
    begin
      if nullif(caller_email, '') is null then
        return coalesce(new, old);
      end if;

      if public.is_active_admin() then
        return new;
      end if;

      raise exception 'Only an active administrator can modify the admin roster'
        using errcode = '42501';
    end;
    $guard$;

    drop trigger if exists cse_archive_admin_users_write_guard
      on public.cse_archive_admin_users;
    create trigger cse_archive_admin_users_write_guard
      before insert or update or delete on public.cse_archive_admin_users
      for each row
      execute function public.guard_admin_roster_writes();

    raise notice 'Roster write-guard trigger installed.';
  else
    raise warning
      'public.is_active_admin() not found - run migration 005 to install the roster write-guard trigger. RLS above is still active.';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 5. Clean up any rows that the earlier hole may have left behind.
--
--    Only obvious probe/attacker test addresses are removed. Real accounts are
--    left alone so this never deletes a legitimate administrator.
-- -----------------------------------------------------------------------------
delete from public.cse_archive_admin_users
 where email ~* '^(zz-probe-|zz-text-|zz-scope-|attacker|attacker-|test-|probe-)'
    or email like '%@example.invalid';

-- -----------------------------------------------------------------------------
-- 6. Verify. Run these and read the output.
--
--    (a) Only a SELECT policy should remain:
--
--      select policyname, cmd, roles, qual
--        from pg_policies
--       where schemaname = 'public'
--         and tablename  = 'cse_archive_admin_users';
--
--      EXPECT exactly one row, cmd = SELECT.
--
--    (b) RLS forced (so the owner cannot bypass it):
--
--      select relname, relrowsecurity, relforcerowsecurity
--        from pg_class
--       where oid = 'public.cse_archive_admin_users'::regclass;
--
--      EXPECT relrowsecurity = t AND relforcerowsecurity = t.
--
--    (c) Your real roster should be intact:
--
--      select email, role, status from public.cse_archive_admin_users order by email;
--
--    (d) Confirm the anon key is now refused. From a terminal:
--
--      curl -s -o /dev/null -w '%{http_code}\n' \
--        "$SUPABASE_URL/rest/v1/cse_archive_admin_users" \
--        -H "apikey: $SUPABASE_ANON_KEY" \
--        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
--        -H "Content-Type: application/json" \
--        --data '{"email":"attacker@example.invalid","role":"super_admin"}'
--
--      EXPECT 401 or 403. If it returns 201, STOP and re-run this file.
-- -----------------------------------------------------------------------------

notify pgrst, 'reload schema';