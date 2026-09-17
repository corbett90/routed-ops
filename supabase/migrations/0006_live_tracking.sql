-- Live tracking (concept/demo pass): let a driver's phone push GPS
-- breadcrumbs to location_pings while a route is actively being driven,
-- not just at the instant of a delivery capture.
--
-- NOTE ON NUMBERING: the repo's migrations jump from 0003 to 0006 here
-- because migrations 0004 (fix_store_access_rls) and 0005 (staff_access)
-- were applied directly via the Supabase SQL Editor and, per the ops
-- setup guide, were never actually committed as files in this repo. This
-- migration doesn't depend on their exact file contents — only on the
-- staff_access table already existing and already having a self-row-only
-- RLS policy (true as of the live database) — so it's safe to run as-is.
-- Worth a follow-up cleanup pass to add the missing 0004/0005 files to
-- this repo for a reproducible history, but that's a separate errand.

-- ---------------------------------------------------------------------------
-- Broaden location_pings: it originally only accepted a ping tied to one
-- finished delivery row. A driver is on the road between stops most of the
-- day, so pings need a home before any delivery for that stop exists yet.
-- delivery_id stays for the future (e.g. one last ping stamped onto the
-- delivery it ends at), but a ping can now stand on its own against a
-- route_id + vehicle_id instead.
-- ---------------------------------------------------------------------------
alter table location_pings
  alter column delivery_id drop not null;

alter table location_pings
  add column if not exists route_id uuid references routes(id) on delete cascade,
  add column if not exists vehicle_id uuid references vehicles(id) on delete set null;

create index if not exists location_pings_route_idx
  on location_pings (route_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- Realtime: the live map page subscribes to INSERTs on this table directly
-- from the browser (not through the service-role admin client), so it
-- needs to be in the realtime publication.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table location_pings;

-- ---------------------------------------------------------------------------
-- RLS: internal ops pages still WRITE pings via the service-role admin
-- client (bypasses RLS, same as every other ops write) — no INSERT policy
-- needed. But the live map READS pings from the browser under the signed-in
-- staff member's own session, so it needs a real SELECT policy.
--
-- Modeled on the same self-row-only pattern staff_access itself already
-- uses (see the 2026-09-16 RLS fix write-up in the ops setup guide): the
-- subquery below only ever checks for the CURRENT user's own row in
-- staff_access, so it isn't vulnerable to the "policy blocking its own
-- subquery" bug that hit store_access — that bug only bit when a policy's
-- subquery needed to see rows belonging to someone other than the querying
-- user.
-- ---------------------------------------------------------------------------
alter table location_pings enable row level security;

drop policy if exists "Staff can read location pings" on location_pings;
create policy "Staff can read location pings"
  on location_pings for select
  to authenticated
  using (
    exists (
      select 1 from staff_access sa
      where lower(sa.email) = lower(auth.jwt() ->> 'email')
    )
  );