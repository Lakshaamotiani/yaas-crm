-- ============================================================
-- YAAS Sales CRM — Avatars storage bucket + RLS
-- ============================================================
-- Creates the public `avatars` bucket and locks down writes so each user
-- can only upload/replace/delete files inside a folder named after their
-- own auth.uid(). Reads are public (avatar URLs need to be servable from
-- the <img> tag without auth).
--
-- File path convention: `<user_id>/<filename>` — e.g. `abc-123/avatar.jpg`.
-- Anything outside the user's folder is rejected by the policy.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Drop existing policies so re-running this migration is safe.
drop policy if exists "Avatars are publicly readable"  on storage.objects;
drop policy if exists "Users can upload their avatar"  on storage.objects;
drop policy if exists "Users can update their avatar"  on storage.objects;
drop policy if exists "Users can delete their avatar"  on storage.objects;

create policy "Avatars are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

create policy "Users can upload their avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
