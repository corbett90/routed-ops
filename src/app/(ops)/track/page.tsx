import { createAdminClient } from "@/lib/supabase/admin";
import type { Route, RouteAssignment, Vehicle } from "@/lib/types";
import { LiveMap, type RouteMarker, type StopMarker } from "./LiveMap";

type LatestPing = { lat: number; lng: number; recorded_at: string };

export default async function TrackPage() {
  const supabase = createAdminClient();

  const { data: routes } = await supabase
    .from("routes")
    .select(
      "*, route_assignments(*, vehicles(*)), route_stops(id, store_name, lat, lng, scheduled_time)"
    )
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

  const latestByRoute = new Map<string, LatestPing>();
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
      route_stops: {
        id: string;
        store_name: string;
        lat: number | null;
        lng: number | null;
        scheduled_time: string | null;
      }[];
    };
    const activeVehicle =
      typed.route_assignments?.find((a) => a.is_active)?.vehicles ?? null;

    // Only stops that have been geocoded (lat/lng set) can be plotted — a
    // stop added before geocoding existed, or whose address didn't resolve,
    // won't have coordinates yet. Use the "Locate" button on the Routes page
    // to backfill one.
    const stops: StopMarker[] = typed.route_stops
      .filter(
        (s): s is typeof s & { lat: number; lng: number } =>
          s.lat !== null && s.lng !== null
      )
      .map((s) => ({
        stopId: s.id,
        storeName: s.store_name,
        lat: s.lat,
        lng: s.lng,
        scheduledTime: s.scheduled_time,
      }));

    return {
      routeId: route.id,
      routeName: typed.name,
      clientName: typed.client_name,
      vehicleName: activeVehicle?.name ?? null,
      lastPing: latestByRoute.get(route.id) ?? null,
      stops,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Live Map</h1>
        <p className="text-foreground/60 mt-1">
          Vehicles currently sharing their location from the road, alongside
          each route&apos;s stops. Updates in real time as drivers ping in —
          no refresh needed.
        </p>
      </div>
      <LiveMap initialRoutes={routeMarkers} />
    </div>
  );
}