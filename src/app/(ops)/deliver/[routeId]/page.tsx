import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Route, RouteAssignment, RouteStop, Vehicle } from "@/lib/types";
import { RouteTracker } from "./RouteTracker";

export default async function DeliverStopListPage(
  props: PageProps<"/deliver/[routeId]">
) {
  const { routeId } = await props.params;
  const supabase = createAdminClient();

  const { data: route } = await supabase
    .from("routes")
    .select("*, route_assignments(*, vehicles(*))")
    .eq("id", routeId)
    .single();

  if (!route) notFound();

  const typedRoute = route as Route & {
    route_assignments: (RouteAssignment & { vehicles: Vehicle | null })[];
  };
  const activeVehicle =
    typedRoute.route_assignments?.find((a) => a.is_active)?.vehicles ?? null;

  const { data: stops } = await supabase
    .from("route_stops")
    .select("*")
    .eq("route_id", routeId)
    .order("sequence_order");

  // Stops already delivered today, so a driver re-opening this list mid-route
  // can see what's left.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const { data: todaysDeliveries } = await supabase
    .from("deliveries")
    .select("route_stop_id")
    .eq("route_id", routeId)
    .gte("delivered_at", startOfToday.toISOString());

  const deliveredStopIds = new Set(
    (todaysDeliveries ?? []).map((d) => d.route_stop_id)
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/deliver" className="text-sm text-accent hover:underline">
          &larr; Routes
        </Link>
        <h1 className="text-2xl font-bold mt-2">{route.name}</h1>
        <p className="text-foreground/60 mt-1">{route.client_name} — tap a stop to deliver.</p>
      </div>

      <RouteTracker
        routeId={routeId}
        vehicleId={activeVehicle?.id ?? null}
        routeName={typedRoute.name}
      />

      <div className="rounded-lg border border-border bg-white divide-y divide-border">
        {stops && stops.length > 0 ? (
          (stops as RouteStop[]).map((stop) => {
            const done = deliveredStopIds.has(stop.id);
            return (
              <Link
                key={stop.id}
                href={`/deliver/${routeId}/${stop.id}`}
                className="p-5 flex items-center justify-between hover:bg-background/60 active:bg-background"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft/40 text-accent font-semibold text-sm">
                    {stop.sequence_order}
                  </span>
                  <div>
                    <div className="font-semibold">{stop.store_name}</div>
                    {stop.address && (
                      <div className="text-sm text-foreground/50">{stop.address}</div>
                    )}
                  </div>
                </div>
                {done ? (
                  <span className="text-xs font-medium rounded-full bg-green-100 text-green-700 px-3 py-1">
                    Delivered
                  </span>
                ) : (
                  <span className="text-accent text-2xl">&rarr;</span>
                )}
              </Link>
            );
          })
        ) : (
          <p className="p-6 text-sm text-foreground/50">No stops on this route yet.</p>
        )}
      </div>
    </div>
  );
}