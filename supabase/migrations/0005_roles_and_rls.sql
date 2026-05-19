-- ============================================================
-- YAAS Sales CRM — Roles + role-based RLS
-- ============================================================
-- Tightens the previously open ("authenticated all") RLS policies into a
-- role-aware model. Two roles for now:
--
--   admin — full access. Can do anything any rep can plus delete leads /
--           companies, edit workspace templates, manage teammates.
--   rep   — view + create + edit any data in the workspace, but can only
--           delete activities they created themselves. Cannot delete leads,
--           companies, or modify other users' profiles.
--
-- The policy model deliberately favors trust within a small internal team:
-- reps can edit any deal, not just their own (it's the natural sales-team
-- workflow — Maya needs to edit a lead Diego created when she covers his
-- accounts on Friday). Hard delete is the only knife admins keep to
-- themselves; everything else is collaborative.
-- ============================================================

-- ---------- helper: is_admin() ---------------------------------------------
-- Stable function used inside RLS policies so we don't repeat the join.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ---------- profiles -------------------------------------------------------
-- Admins can edit any profile (e.g. change someone's role); users can edit
-- their own. Reads stay open to all authenticated users so we can render
-- teammate names / avatars across the app.

drop policy if exists "user updates own profile"      on public.profiles;
drop policy if exists "admins update any profile"     on public.profiles;
drop policy if exists "admins insert profiles"        on public.profiles;
drop policy if exists "admins delete profiles"        on public.profiles;

create policy "user updates own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    -- Reps can't escalate themselves to admin.
    and (role = (select role from public.profiles where id = auth.uid()) or public.is_admin())
  );

create policy "admins update any profile" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins insert profiles" on public.profiles
  for insert to authenticated
  with check (public.is_admin());

create policy "admins delete profiles" on public.profiles
  for delete to authenticated
  using (public.is_admin());

-- ---------- leads ----------------------------------------------------------
-- Read/insert/update: any authenticated user. Delete: admins only.

drop policy if exists "authenticated all leads"   on public.leads;
drop policy if exists "authenticated read leads"  on public.leads;
drop policy if exists "authenticated write leads" on public.leads;
drop policy if exists "admins delete leads"       on public.leads;

create policy "authenticated read leads"  on public.leads
  for select to authenticated using (true);
create policy "authenticated write leads" on public.leads
  for insert to authenticated with check (true);
create policy "authenticated update leads" on public.leads
  for update to authenticated using (true) with check (true);
create policy "admins delete leads"       on public.leads
  for delete to authenticated using (public.is_admin());

-- ---------- deals ----------------------------------------------------------
-- Same shape as leads. Delete admin-only.

drop policy if exists "authenticated all deals"    on public.deals;
drop policy if exists "authenticated read deals"   on public.deals;
drop policy if exists "authenticated write deals"  on public.deals;
drop policy if exists "authenticated update deals" on public.deals;
drop policy if exists "admins delete deals"        on public.deals;

create policy "authenticated read deals"   on public.deals
  for select to authenticated using (true);
create policy "authenticated write deals"  on public.deals
  for insert to authenticated with check (true);
create policy "authenticated update deals" on public.deals
  for update to authenticated using (true) with check (true);
create policy "admins delete deals"        on public.deals
  for delete to authenticated using (public.is_admin());

-- ---------- qualifications -------------------------------------------------
-- Open writes for the team (BANT data is shared knowledge).

drop policy if exists "authenticated all qualifications"    on public.qualifications;
drop policy if exists "authenticated read qualifications"   on public.qualifications;
drop policy if exists "authenticated write qualifications"  on public.qualifications;
drop policy if exists "authenticated update qualifications" on public.qualifications;

create policy "authenticated read qualifications"   on public.qualifications
  for select to authenticated using (true);
create policy "authenticated write qualifications"  on public.qualifications
  for insert to authenticated with check (true);
create policy "authenticated update qualifications" on public.qualifications
  for update to authenticated using (true) with check (true);

-- ---------- activities -----------------------------------------------------
-- Reps can delete activities they authored themselves; admins can delete
-- any. (Stage-change activities and other system rows are owned by the user
-- whose action triggered them.)

drop policy if exists "authenticated all activities"    on public.activities;
drop policy if exists "authenticated read activities"   on public.activities;
drop policy if exists "authenticated write activities"  on public.activities;
drop policy if exists "authenticated update activities" on public.activities;
drop policy if exists "delete own or admin activities"  on public.activities;

create policy "authenticated read activities"   on public.activities
  for select to authenticated using (true);
create policy "authenticated write activities"  on public.activities
  for insert to authenticated with check (true);
create policy "authenticated update activities" on public.activities
  for update to authenticated using (true) with check (true);
create policy "delete own or admin activities"  on public.activities
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------- companies ------------------------------------------------------
-- Same as leads. Delete admin-only.

drop policy if exists "authenticated all companies"    on public.companies;
drop policy if exists "authenticated read companies"   on public.companies;
drop policy if exists "authenticated write companies"  on public.companies;
drop policy if exists "authenticated update companies" on public.companies;
drop policy if exists "admins delete companies"        on public.companies;

create policy "authenticated read companies"   on public.companies
  for select to authenticated using (true);
create policy "authenticated write companies"  on public.companies
  for insert to authenticated with check (true);
create policy "authenticated update companies" on public.companies
  for update to authenticated using (true) with check (true);
create policy "admins delete companies"        on public.companies
  for delete to authenticated using (public.is_admin());

-- ---------- promote the seed user to admin --------------------------------
-- The first profile that exists (the founder who set up the workspace) gets
-- the admin role. Re-running this is a no-op once anyone has admin.

update public.profiles
   set role = 'admin'
 where id = (
   select id from public.profiles
    order by created_at asc
    limit 1
 )
   and not exists (select 1 from public.profiles where role = 'admin');
