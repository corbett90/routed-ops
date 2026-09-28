-- On-time tracking: snapshot each stop's scheduled arrival time onto the
-- delivery row at the moment the driver completes it.
--
-- Why a snapshot instead of just joining to route_stops.scheduled_time at
-- report time: the stop's scheduled time can be edited later (e.g. a stop
-- moves from 10:00 to 10:30). Without a snapshot, every past delivery at
-- that stop would silently be re-graded against the NEW time, changing
-- historical on-time results. With it, each delivery is graded against the
-- schedule that was in effect when it happened.
--
-- Nullable on purpose: deliveries captured before this migration have no
-- snapshot. The Excel export falls back to the stop's current scheduled
-- time for those rows and labels them as such.
--
-- RUN THIS BEFORE deploying the matching app code — the updated
-- createDeliveryCapture action writes to this column, and delivery capture
-- will fail until it exists.

alter table deliveries add column if not exists scheduled_time time;

create index if not exists deliveries_delivered_at_idx on deliveries (delivered_at);
