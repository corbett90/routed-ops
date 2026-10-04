-- Driver-trial fixes batch (2026-10-03).
--
-- RUN THIS in the Supabase SQL editor BEFORE deploying the matching app
-- code — the staff page, removeStaffAccess action, delivery capture, and
-- portal deliveries page all read these columns, and the portal's explicit
-- column list references customer_notes by name.
--
-- ---------------------------------------------------------------------------
-- Item 1 — owner protection for staff_access.
-- Adds is_owner. Exactly one row (Brad's) must be flagged; until then the
-- staff page shows no owner badge and the server-side removal guard has no
-- row to protect (it fails closed: removals error until the column exists).
-- ---------------------------------------------------------------------------
alter table staff_access
  add column if not exists is_owner boolean not null default false;

/* TODO (Brad, in the SQL editor after running the above):
   Flag your own staff row as the owner. The app cannot do this for you —
   there is deliberately no UI for it. Example:

     update staff_access set is_owner = true where email = 'you@routedparts.com';

   Use the email you sign in to the ops app with. Until this is set, the
   "Owner" badge won't appear and any admin can still remove any other
   admin. After it is set, the owner row can't be removed from the staff
   page or via the removeStaffAccess action — only direct database access
   can change it.
*/

-- ---------------------------------------------------------------------------
-- Item 5 — three notes fields.
--
-- route_stops.driver_instructions: written by an admin ahead of time, per
-- stop (e.g. "use back dock, ask for Maria"). Shown to the driver on the
-- stop list and the capture page.
--
-- deliveries.driver_notes: written by the driver at capture. INTERNAL ONLY —
-- never exposed to the customer portal. The portal deliveries page selects
-- an explicit column list that omits this column; keep it that way.
--
-- deliveries.customer_notes: written by the driver at capture, shown to the
-- customer on the portal Proof of Delivery page.
-- ---------------------------------------------------------------------------
alter table route_stops
  add column if not exists driver_instructions text;

alter table deliveries
  add column if not exists driver_notes text,
  add column if not exists customer_notes text;
