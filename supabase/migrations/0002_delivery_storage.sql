-- Storage bucket for driver-captured photos (PO/BOL, drop photos) and signatures.
-- Public-read so photo/signature URLs can be displayed directly in the app;
-- anon insert so the driver capture flow can upload without an auth session yet
-- (matches the same no-auth-yet, anon-key approach used for the tables — see
-- the note in the setup guide about adding real auth + RLS before this holds
-- real operational data).

insert into storage.buckets (id, name, public)
values ('delivery-media', 'delivery-media', true)
on conflict (id) do nothing;

-- Anyone can read (needed for the public bucket URLs to resolve in <img> tags).
-- Postgres doesn't support "create policy if not exists", so drop-then-create
-- instead — this makes the migration safe to run more than once.
drop policy if exists "Public read for delivery media" on storage.objects;
create policy "Public read for delivery media"
  on storage.objects for select
  using (bucket_id = 'delivery-media');

-- The anon key can upload into this bucket (driver capture flow, no login yet).
drop policy if exists "Anon upload for delivery media" on storage.objects;
create policy "Anon upload for delivery media"
  on storage.objects for insert
  with check (bucket_id = 'delivery-media');
