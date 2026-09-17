"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { CircleMarker, Map as LeafletMap } from "leaflet";
import { createClient } from "@/lib/supabase/client";

export type RouteMarker = {
  routeId: string;
  routeName: string;
  clientName: string;
  vehicleName: string | null;
  lastPing: { lat: number; lng: number; recorded_at: string } | null;
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

// Leaflet reaches for `window` at import time, so it can only ever be
// imported inside this effect (which only runs in the browser) — never at
// module scope, or the server-rendered pass of this "use client" component
// would crash trying to prerender it.
export function LiveMap({ initialRoutes }: { initialRoutes: RouteMarker[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, CircleMarker>>(new Map());
  // Route metadata (name/client/vehicle) for popup text, kept in a ref so a
  // realtime ping that arrives later can still look up its route's label
  // without re-subscribing.
  const routeInfoRef = useRef<Map<string, RouteMarker>>(
    new Map(initialRoutes.map((r) => [r.routeId, r]))
  );

  useEffect(() => {
    let disposed = false;
    let dispose = () => {};

    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !containerRef.current || mapRef.current) return;

      const withPing = initialRoutes.find((r) => r.lastPing);
      const center: [number, number] = withPing?.lastPing
        ? [withPing.lastPing.lat, withPing.lastPing.lng]
        : DEFAULT_CENTER;

      const map = L.map(containerRef.current).setView(center, 11);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      function upsertMarker(
        routeId: string,
        lat: number,
        lng: number,
        recordedAt: string
      ) {
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

      for (const route of initialRoutes) {
        if (route.lastPing) {
          upsertMarker(
            route.routeId,
            route.lastPing.lat,
            route.lastPing.lng,
            route.lastPing.recorded_at
          );
        }
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
            upsertMarker(row.route_id, row.lat, row.lng, row.recorded_at);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anyLive = initialRoutes.some((r) => r.lastPing);

  return (
    <div className="rounded-lg border border-border bg-white overflow-hidden">
      <div ref={containerRef} className="h-[520px] w-full" />
      {!anyLive && (
        <p className="p-4 text-sm text-foreground/50 border-t border-border">
          No vehicles are sharing their location yet — a driver turns this on
          from the &quot;Deliver&quot; page for their route.
        </p>
      )}
    </div>
  );
}