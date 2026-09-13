-- Routed operations schema
-- Core entities: vehicles, routes, stops, vehicle-route assignments, and deliveries.
-- Every other feature (driver capture, live tracking, proof of delivery) reads/writes
-- against the `deliveries` table, so this migration is the foundation for all of them.

-- ---------------------------------------------------------------------------
-- Vehicles
-- ---------------------------------------------------------------------------
create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- e.g. "Model 3 - Route 4"
  vehicle_type text not null,         -- e.g. "sedan", "suv", "pickup"
  make text,
  model text,
  year int,
  license_plate text,
  vin text,
  status text not null default 'active' check (status in ('active', 'maintenance', 'retired')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Routes
-- ---------------------------------------------------------------------------
create table if not exists routes (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- e.g. "Route 4"
  client_name text not null,          -- e.g. "NAPA Auto Parts - Cobb County"
  runs_per_day int not null default 1,
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Stops on a route (the fixed sequence of store locations)
-- ---------------------------------------------------------------------------
create table if not exists route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes(id) on delete cascade,
  store_name text not null,           -- e.g. "Auto Shop #402"
  address text,
  lat double precision,
  lng double precision,
  sequence_order int not null,        -- 1, 2, 3... order of stops on the route
  created_at timestamptz not null default now(),
  unique (route_id, sequence_order)
);

-- ---------------------------------------------------------------------------
-- Vehicle <-> Route assignment ("The Right Vehicle, Every Route")
-- A route has exactly one active vehicle assignment at a time; history is kept
-- by closing out the previous assignment's active flag rather than deleting it.
-- ---------------------------------------------------------------------------
create table if not exists route_assignments (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id) on delete restrict,
  is_active boolean not null default true,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz
);

-- Only one active assignment per route at a time.
create unique index if not exists one_active_assignment_per_route
  on route_assignments (route_id)
  where is_active;

-- ---------------------------------------------------------------------------
-- Deliveries (one row per stop, per run of a route on a given day)
-- This is the record that "No Paperwork Headaches" and "Proof of Delivery"
-- both write to, and that "Live Tracking" reads status off of.
-- ---------------------------------------------------------------------------
create table if not exists deliveries (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes(id) on delete restrict,
  route_stop_id uuid not null references route_stops(id) on delete restrict,
  vehicle_id uuid references vehicles(id) on delete set null,
  driver_name text,                   -- FK to a drivers/users table once auth is added
  po_number text,
  bol_number text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_transit', 'delivered', 'failed')),
  scheduled_at timestamptz not null default now(),
  delivered_at timestamptz,
  signature_url text,                 -- captured signature image (Supabase Storage)
  photo_url text,                     -- PO/BOL or drop photo (Supabase Storage)
  delivered_lat double precision,
  delivered_lng double precision,
  created_at timestamptz not null default now()
);

create index if not exists deliveries_po_number_idx on deliveries (po_number);
create index if not exists deliveries_route_stop_idx on deliveries (route_stop_id);
create index if not exists deliveries_status_idx on deliveries (status);

-- ---------------------------------------------------------------------------
-- Location pings (driver phone GPS breadcrumbs, for "Live Tracking")
-- ---------------------------------------------------------------------------
create table if not exists location_pings (
  id bigint generated always as identity primary key,
  delivery_id uuid not null references deliveries(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  recorded_at timestamptz not null default now()
);

create index if not exists location_pings_delivery_idx on location_pings (delivery_id, recorded_at desc);
