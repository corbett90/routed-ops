-- Customer portal: per-store logins, scheduled arrival times, and real
-- database-level access control.
--
-- IMPORTANT CONTEXT: everything before this migration (vehicles, routes,
-- route_stops, deliveries, etc.) has had no login and no RLS — fine while
-- only Brad and his drivers used it. This migration is the point outside
-- companies get access, so it also LOCKS DOWN the anon key's access to
-- these tables. After running this, the anon key alone can no longer read
-- or write vehicles/routes/route_stops/route_assignments/deliveries —
-- the app's internal pages (Vehicles, Routes, Deliver, Proof of Delivery)
-- must be updated to use the service-role key instead (server-side only,
-- never sent to the browser) or they will start failing. See the app code
-- changes that accompany this migration and the setup guide's new step
-- for the service role key.

-- ---------------------------------------------------------------------------
-- Scheduled arrival time per stop (what time the driver is supposed to
-- show up each day). The ACTUAL arrival is already captured per-delivery
-- as deliveries.delivered_at — this is the counterpart "expected" value.
-- ---------------------------------------------------------------------------
alter table route_stops add column if not exists scheduled_time time;

-- ---------------------------------------------------------------------------
-- Store access: maps a customer's login email to the stop(s) they're
-- allowed to see. One row per (email, stop) pair — a store logging in with
-- this email can see that stop's route/vehicle/schedule/deliveries only.
-- ---------------------------------------------------------------------------
create table if not exists store_access (
  id uuid primary key default gen_random_uuid(),
  route_stop_id uuid not null references route_stops(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  unique (route_stop_id, email)
);

create index if not exists store_access_email_idx on store_access (lower(email));

-- ---------------------------------------------------------------------------
-- Row Level Security: a logged-in customer (Supabase Auth session) can only
-- see rows tied to a stop their email has been granted access to, via
-- store_access. No policies are created for the `anon` role on these
-- tables — deliberately: the internal admin app must use the service-role
-- key from here on for these tables, not the public anon key.
-- ---------------------------------------------------------------------------
alter table route_stops enable row level security;
alter table routes enable row level security;
alter table route_assignments enable row level security;
alter table vehicles enable row level security;
alter table deliveries enable row level security;
alter table store_access enable row level security;

drop policy if exists "Store can read its own stops" on route_stops;
create policy "Store can read its own stops"
  on route_stops for select
  to authenticated
  using (
    exists (
      select 1 from store_access sa
      where sa.route_stop_id = route_stops.id
        and lower(sa.email) = lower(auth.jwt() ->> 'email')
    )
  );

drop policy if exists "Store can read its own route" on routes;
create policy "Store can read its own route"
  on routes for select
  to authenticated
  using (
    exists (
      select 1 from route_stops rs
      join store_access sa on sa.route_stop_id = rs.id
      where rs.route_id = routes.id
        and lower(sa.email) = lower(auth.jwt() ->> 'email')
    )
  );

drop policy if exists "Store can read its own route assignment" on route_assignments;
create policy "Store can read its own route assignment"
  on route_assignments for select
  to authenticated
  using (
    exists (
      select 1 from route_stops rs
      join store_access sa on sa.route_stop_id = rs.id
      where rs.route_id = route_assignments.route_id
        and lower(sa.email) = lower(auth.jwt() ->> 'email')
    )
  );

drop policy if exists "Store can read its assigned vehicle" on vehicles;
create policy "Store can read its assigned vehicle"
  on vehicles for select
  to authenticated
  using (
    exists (
      select 1 from route_assignments ra
      join route_stops rs on rs.route_id = ra.route_id
      join store_access sa on sa.route_stop_id = rs.id
      where ra.vehicle_id = vehicles.id
        and ra.is_active
        and lower(sa.email) = lower(auth.jwt() ->> 'email')
    )
  );

drop policy if exists "Store can read its own deliveries" on deliveries;
create policy "Store can read its own deliveries"
  on deliveries for select
  to authenticated
  using (
    exists (
      select 1 from store_access sa
      where sa.route_stop_id = deliveries.route_stop_id
        and lower(sa.email) = lower(auth.jwt() ->> 'email')
    )
  );

-- A store account never needs to see the raw access-grant list itself.
drop policy if exists "No direct access to store_access" on store_access;
create policy "No direct access to store_access"
  on store_access for select
  to authenticated
  using (false);
