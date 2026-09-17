"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { CircleMarker, Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { createClient } from "@/lib/supabase/client";

export type StopMarker = {
  stopId: string;
  storeName: string;
  lat: number;
  lng: number;
  scheduledTime: string | null;
};

export type RouteMarker = {
  routeId: string;
  routeName: string;
  clientName: string;
  vehicleName: string | null;
  lastPing: { lat: number; lng: number; recorded_at: string } | null;
  stops: StopMarker[];
};

// Marietta, GA — sensible default map center before any ping has ever come
// in (Routed operates only in the Marietta/Cobb County area, same as the
// hardcoded Eastern-time display elsewhere in this app).
const DEFAULT_CENTER: [number, number] = [33.9526, -84.5499];

function formatLastSeen(recordedAt: string) {
  return new Date(recordedAt).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
  });
}

function formatScheduledTime(scheduledTime: string | null) {
  // Postgres "time" comes back as "HH:MM:SS" — trim to "HH:MM".
  return scheduledTime ? scheduledTime.slice(0, 5) : null;
}

// Leaflet reaches for `window` at import time, so it can only ever be
// imported inside this effect (which only runs in the browser) — never at
// module scope, or the server-rendered pass of this "use client" component
// would crash trying to prerender it.
export function LiveMap({ initialRoutes }: { initialRoutes: RouteMarker[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const markersRef = useRef<Map<string, CircleMarker>>(new Map());

  // Every route's last known vehicle position, kept up to date regardless of
  // whether that route is currently shown — so switching a route's filter
  // pill back on can redraw it instantly from memory instead of waiting
  // for its next ping.
  const positionsRef = useRef
    Map<string, { lat: number; lng: number; recorded_at: string }>
  >(
    new Map(
      initialRoutes
        .filter((r): r is RouteMarker & { lastPing: NonNullable<RouteMarker["lastPing"]> } => r.lastPing !== null)
        .map((r) => [r.routeId, r.lastPing])
    )
  );

  // Each route's stop locations (static — these don't move like a vehicle
  // does, so they're only ever drawn/removed on toggle, never updated live).
  const stopsDataRef = useRef<Map<string, StopMarker[]>>(
    new Map(initialRoutes.map((r) => [r.routeId, r.stops]))
  );
  const stopMarkersRef = useRef<Map<string, LeafletMarker[]>>(new Map());

  // Route metadata (name/client/vehicle) for popup text and filter labels.
  const routeInfoRef = useRef<Map<string, RouteMarker>>(
    new Map(initialRoutes.map((r) => [r.routeId, r]))
  );

  // Which routes are currently checked "on" in the filter row. This is the
  // REAL source of truth used by the imperative map code below (read via
  // .current inside drawOrUpdateMarker, so it's always fresh even though
  // that function was captured once by the realtime subscription at
  // mount-time). visibleIds (state) exists only to re-render the pills.
  const visibilityRef = useRef<Set<string>>(
    new Set(initialRoutes.map((r) => r.routeId))
  );
  const [visibleIds, setVisibleIds] = useState<Set<string>>(
    () => new Set(initialRoutes.map((r) => r.routeId))
  );
  const [hasLiveData, setHasLiveData] = useState(() =>
    initialRoutes.some((r) => r.lastPing !== null)
  );

  function drawOrUpdateVehicleMarker(
    routeId: string,
    lat: number,
    lng: number,
    recordedAt: string
  ) {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !visibilityRef.current.has(routeId)) return;

    const info = routeInfoRef.current.get(routeId);
    const popup = info
      ? `<strong>${info.routeName}</strong><br/>${info.clientName}` +
        (info.vehicleName ? `<br/>${info.vehicleName}` : "") +
        `<br/><span style="color:#64748b">Last ping: ${formatLastSeen(recordedAt)}</span>`
      : `Route ${routeId}<br/>Last ping: ${formatLastSeen(recordedAt)}`;

    const existing = markersRef.current.get(routeId);
    if (existing) {
      existing.setLatLng([lat, lng]);
      existing.setPopupContent(popup);
    } else {
      const marker = L.circleMarker([lat, lng], {
        radius: 9,
        color: "#2563eb",
        fillColor: "#2563eb",
        fillOpacity: 0.85,
        weight: 2,
      })
        .addTo(map)
        .bindPopup(popup);
      markersRef.current.set(routeId, marker);
    }
  }

  // Stop markers as a yellow star (a plain HTML div-icon rather than an
  // image-based marker — sidesteps Leaflet's usual bundler asset-path
  // headache with its default marker icons, same reasoning as the
  // circleMarker choice for vehicles above).
  function drawStopsForRoute(routeId: string) {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || stopMarkersRef.current.has(routeId)) return;

    const starIcon = L.divIcon({
      className: "",
      html: '<div style="font-size:18px;line-height:1;filter:drop-shadow(0 1px 1px rgba(0,0,0,.45))">⭐</div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    const stops = stopsDataRef.current.get(routeId) ?? [];
    const markers = stops.map((stop) => {
      const time = formatScheduledTime(stop.scheduledTime);
      const popup =
        `<strong>${stop.storeName}</strong>` +
        (time
          ? `<br/><span style="color:#64748b">Scheduled: ${time}</span>`
          : "");
      return L.marker([stop.lat, stop.lng], { icon: starIcon })
        .addTo(map)
        .bindPopup(popup);
    });

    stopMarkersRef.current.set(routeId, markers);
  }

  function removeStopsForRoute(routeId: string) {
    const map = mapRef.current;
    const markers = stopMarkersRef.current.get(routeId);
    if (markers && map) {
      markers.forEach((marker) => map.removeLayer(marker));
    }
    stopMarkersRef.current.delete(routeId);
  }

  useEffect(() => {
    let disposed = false;
    let dispose = () => {};

    (async () => {
      const L = (await import("leaflet")).default;
      leafletRef.current = L;
      if (disposed || !containerRef.current || mapRef.current) return;

      const firstStop = initialRoutes.flatMap((r) => r.stops)[0];
      const firstPosition = positionsRef.current.values().next().value;
      const center: [number, number] = firstPosition
        ? [firstPosition.lat, firstPosition.lng]
        : firstStop
          ? [firstStop.lat, firstStop.lng]
          : DEFAULT_CENTER;

      const map = L.map(containerRef.current).setView(center, 11);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      for (const [routeId, pos] of positionsRef.current) {
        drawOrUpdateVehicleMarker(routeId, pos.lat, pos.lng, pos.recorded_at);
      }
      for (const routeId of visibilityRef.current) {
        drawStopsForRoute(routeId);
      }

      const supabase = createClient();
      const channel = supabase
        .channel("location_pings_live")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "location_pings" },
          (payload) => {
            const row = payload.new as {
              route_id: string | null;
              lat: number;
              lng: number;
              recorded_at: string;
            };
            if (!row.route_id) return;
            positionsRef.current.set(row.route_id, {
              lat: row.lat,
              lng: row.lng,
              recorded_at: row.recorded_at,
            });
            setHasLiveData(true);
            drawOrUpdateVehicleMarker(
              row.route_id,
              row.lat,
              row.lng,
              row.recorded_at
            );
          }
        )
        .subscribe();

      dispose = () => {
        supabase.removeChannel(channel);
        map.remove();
        mapRef.current = null;
      };
    })();

    return () => {
      disposed = true;
      dispose();
    };
    // Only ever set up once per mount — initialRoutes is this page's
    // server-rendered starting snapshot, not something that should tear
    // down and rebuild the map/subscription on every re-render.
  }, []);

  function toggleRoute(routeId: string) {
    const isCurrentlyOn = visibilityRef.current.has(routeId);

    if (isCurrentlyOn) {
      visibilityRef.current.delete(routeId);
      const marker = markersRef.current.get(routeId);
      if (marker && mapRef.current) {
        mapRef.current.removeLayer(marker);
        markersRef.current.delete(routeId);
      }
      removeStopsForRoute(routeId);
    } else {
      visibilityRef.current.add(routeId);
      const pos = positionsRef.current.get(routeId);
      if (pos) drawOrUpdateVehicleMarker(routeId, pos.lat, pos.lng, pos.recorded_at);
      drawStopsForRoute(routeId);
    }

    setVisibleIds(new Set(visibilityRef.current));
  }

  return (
    <div className="space-y-3">
      {initialRoutes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {initialRoutes.map((route) => {
            const isOn = visibleIds.has(route.routeId);
            return (
              <button
                key={route.routeId}
                type="button"
                onClick={() => toggleRoute(route.routeId)}
                aria-pressed={isOn}
                className={`text-xs font-medium rounded-full px-3 py-1.5 border transition-colors ${
                  isOn
                    ? "bg-accent-soft/30 border-accent-soft text-accent"
                    : "bg-background border-border text-foreground/40"
                }`}
              >
                {route.routeName}
              </button>
            );
          })}
        </div>
      )}
      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <div ref={containerRef} className="h-[520px] w-full" />
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-xs text-foreground/50">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: "#2563eb" }}
            />
            Vehicle
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden>⭐</span>
            Stop / customer location
          </span>
        </div>
        {!hasLiveData && (
          <p className="p-4 text-sm text-foreground/50 border-t border-border">
            No vehicles are sharing their location yet — a driver turns this
            on from the &quot;Deliver&quot; page for their route.
          </p>
        )}
      </div>
    </div>
  );
}