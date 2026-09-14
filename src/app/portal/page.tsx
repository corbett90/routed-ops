import { createClient } from "@/lib/supabase/server";
import type { Delivery, RouteWithDetails } from "@/lib/types";

// Customer dashboard: "what's assigned to my store, when is it scheduled,
// and did it actually show up." This queries with the regular anon-key,
// cookie-aware client — Row Level Security (migration 0003) is what
// actually restricts the results to this logged-in email's own stop(s),
// not any filtering done here in the app.
export default async function PortalDashboardPage() {
  const supabase = await createClient();

  const { data: stops, error } = await supabase
    .from("route_stops")
    .select("*, routes(*, route_assignments(*, vehicles(*)))")
    .order("store_name");

  const typedStops = (stops ?? []) as (RouteWithDetails["route_stops"][number] & {
    routes: RouteWithDetails | null;
  })[];

  const stopIds = typedStops.map((s) => s.id);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const { data: todaysDeliveries } = stopIds.length
    ? await supabase
        .from("deliveries")
        .select("*")
        .in("route_stop_id", stopIds)
        .gte("delivered_at", startOfToday.toISOString())
        .order("delivered_at", { ascending: false })
    : { data: [] as Delivery[] };

  // Most recent delivery today per stop.
  const latestByStop = new Map<string, Delivery>();
  (todaysDeliveries ?? []).forEach((d) => {
    if (!latestByStop.has(d.route_stop_id)) latestByStop.set(d.route_stop_id, d);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your Deliveries</h1>
        <p className="text-foreground/60 mt-1">Today&apos;s scheduled and actual arrivals.</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          Couldn&apos;t load your stores: {error.message}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {typedStops.length > 0 ? (
          typedStops.map((stop) => {
            const activeAssignment = stop.routes?.route_assignments?.find(
              (a) => a.is_active
            );
            const delivery = latestByStop.get(stop.id);

            return (
              <div key={stop.id} className="rounded-lg border border-border bg-white p-5 space-y-3">
                <div>
                  <div className="font-semibold">{stop.store_name}</div>
                  <div className="text-sm text-foreground/60">
                    {stop.routes?.name}
                    {activeAssignment?.vehicles
                      ? ` · ${activeAssignment.vehicles.name}`
                      : ""}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-background border border-border px-3 py-1">
                    Scheduled:{" "}
                    {stop.scheduled_time
                      ? formatTimeOfDay(stop.scheduled_time)
                      : "not set"}
                  </span>
                  {delivery ? (
                    <span className="rounded-full bg-green-100 text-green-700 px-3 py-1 font-medium">
                      Arrived:{" "}
                      {new Date(delivery.delivered_at!).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        timeZone: "America/New_York",
                      })}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 text-amber-700 px-3 py-1 font-medium">
                      Not yet delivered today
                    </span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          !error && (
            <p className="text-sm text-foreground/50 sm:col-span-2">
              No stores are linked to this login yet. Contact Routed to get set up.
            </p>
          )
        )}
      </div>
    </div>
  );
}

function formatTimeOfDay(time: string) {
  // time is "HH:MM:SS" from Postgres — build a Date just to reuse
  // toLocaleTimeString's formatting rather than hand-rolling 12-hour math.
  const [hours, minutes] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
