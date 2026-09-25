-- Public bucket: profile pictures need to be viewable by anyone (e.g. on
-- recipes), so reads don't need signed URLs or RLS policies. All writes
-- still go exclusively through our own server (service_role key), the same
-- as public.users/public.sessions, since storage.objects RLS is left with
-- no policies for anon/authenticated - identical trust model, just extended
-- to Storage.
--
-- file_size_limit is a bucket-level safety net (defense in depth) on top of
-- the application-level size check in app/api/account/avatar/route.ts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
