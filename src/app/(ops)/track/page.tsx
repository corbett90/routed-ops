import { createAdminClient } from "@/lib/supabase/admin";
import type { Route, RouteAssignment, Vehicle } from "@/lib/types";
import { LiveMap, type RouteMarker } from "./LiveMap";

export default async function TrackPage() {
  const supabase = createAdminClient();

  const { data: routes } = await supabase
    .from("routes")
    .select("*, route_assignments(*, vehicles(*))")
    .eq("status", "active")
    .order("name");

  // Most recent 200 pings, newest first, then keep only the first (= latest)
  // one seen per route — same "pull recent rows, filter in-app" pattern the
  // Proof of Delivery search already uses rather than a DISTINCT ON query.
  const { data: recentPings } = await supabase
    .from("location_pings")
    .select("route_id, lat, lng, recorded_at")
    .not("route_id", "is", null)
    .order("recorded_at", { ascending: false })
    .limit(200);

  const latestByRoute = new Map
    string,
    { lat: number; lng: number; recorded_at: string }
  >();
  for (const ping of recentPings ?? []) {
    if (ping.route_id && !latestByRoute.has(ping.route_id)) {
      latestByRoute.set(ping.route_id, {
        lat: ping.lat,
        lng: ping.lng,
        recorded_at: ping.recorded_at,
      });
    }
  }

  const routeMarkers: RouteMarker[] = (routes ?? []).map((route) => {
    const typed = route as Route & {
      route_assignments: (RouteAssignment & { vehicles: Vehicle | null })[];
    };
    const activeVehicle =
      typed.route_assignments?.find((a) => a.is_active)?.vehicles ?? null;
    return {
      routeId: route.id,
      routeName: typed.name,
      clientName: typed.client_name,
      vehicleName: activeVehicle?.name ?? null,
      lastPing: latestByRoute.get(route.id) ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Live Map</h1>
        <p className="text-foreground/60 mt-1">
          Vehicles currently sharing their location from the road. Updates in
          real time as drivers ping in — no refresh needed.
        </p>
      </div>
      <LiveMap initialRoutes={routeMarkers} />
    </div>
  );
}