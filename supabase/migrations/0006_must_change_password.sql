-- ============================================================
-- YAAS Sales CRM — must_change_password flag
-- ============================================================
-- When an admin creates a teammate via the invite flow, we set their
-- temporary password and flip this flag to TRUE. The app intercepts the
-- next sign-in and forces a password change before the user can do
-- anything else. Once they pick a new password, the flag flips back to
-- FALSE and they get full access.
-- ============================================================

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

-- A user can clear the flag on themselves (after they change their password)
-- — already covered by the existing "user updates own profile" policy in
-- migration 0005. Admins can also flip it for other users via the
-- "admins update any profile" policy.
