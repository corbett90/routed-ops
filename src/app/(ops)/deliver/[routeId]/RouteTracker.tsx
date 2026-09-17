"use client";

import { useEffect, useRef, useState } from "react";
import { logLocationPing } from "@/app/actions";

// Don't hammer the DB (or Vercel's function invocations) on every GPS fix —
// watchPosition can fire multiple times a second. A breadcrumb every ~15s is
// plenty for a "where's the truck right now" map.
const PING_INTERVAL_MS = 15_000;

export function RouteTracker({
  routeId,
  vehicleId,
  routeName,
}: {
  routeId: string;
  vehicleId: string | null;
  routeName: string;
}) {
  const [tracking, setTracking] = useState(false);
  const [status, setStatus] = useState<"idle" | "watching" | "error">("idle");
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);

  // Stop watching the GPS if the driver navigates away without hitting
  // "Stop tracking" — don't leave the browser's location sensor running.
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  function start() {
    if (!navigator.geolocation) {
      setErrorMsg("This browser doesn't support location sharing.");
      setStatus("error");
      return;
    }

    setErrorMsg(null);
    setTracking(true);
    setStatus("watching");
    lastSentRef.current = 0;

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        if (now - lastSentRef.current < PING_INTERVAL_MS) return;
        lastSentRef.current = now;

        const fd = new FormData();
        fd.set("route_id", routeId);
        if (vehicleId) fd.set("vehicle_id", vehicleId);
        fd.set("lat", String(pos.coords.latitude));
        fd.set("lng", String(pos.coords.longitude));

        const result = await logLocationPing(fd);
        if (result?.error) {
          setErrorMsg(result.error);
          setStatus("error");
        } else {
          setStatus("watching");
          setLastSentAt(new Date());
        }
      },
      (err) => {
        setErrorMsg(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — enable it for this site in your phone's browser settings."
            : "Couldn't get a location fix right now."
        );
        setStatus("error");
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 }
    );
  }

  function stop() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
    setStatus("idle");
  }

  return (
    <div className="rounded-lg border border-border bg-white p-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <span
          className={`h-2.5 w-2.5 rounded-full shrink-0 ${
            tracking ? "bg-green-500 animate-pulse" : "bg-foreground/20"
          }`}
        />
        <div className="text-sm">
          <div className="font-medium">
            {tracking ? `Sharing location for ${routeName}` : "Live tracking is off"}
          </div>
          <div className="text-foreground/50 text-xs">
            {status === "error" && errorMsg}
            {status === "watching" &&
              !errorMsg &&
              (lastSentAt
                ? `Last ping sent at ${lastSentAt.toLocaleTimeString("en-US", {
                    timeZone: "America/New_York",
                  })}`
                : "Waiting for a GPS fix…")}
            {status === "idle" &&
              "Turn this on before you start driving so dispatch can see the vehicle move on the live map."}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={tracking ? stop : start}
        className={`shrink-0 rounded-md px-4 py-2 text-sm font-semibold ${
          tracking
            ? "bg-red-50 text-red-700 border border-red-200"
            : "bg-accent text-white"
        }`}
      >
        {tracking ? "Stop tracking" : "Start tracking route"}
      </button>
    </div>
  );
}