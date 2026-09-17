"use client";

import { useState } from "react";
import { regeocodeStop } from "@/app/actions";

// Backfills (or refreshes) a stop's map coordinates from its typed address.
// Shown next to every stop on the Routes page so a stop added before
// geocoding existed — or one whose address didn't resolve the first time —
// can get onto the live map (src/app/(ops)/track) without re-creating it.
export function LocateStopButton({
  routeId,
  stopId,
  address,
  hasCoords,
}: {
  routeId: string;
  stopId: string;
  address: string | null;
  hasCoords: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleClick() {
    if (!address) {
      setErrorMsg("Add an address to this stop first.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setErrorMsg(null);

    const result = await regeocodeStop(routeId, stopId, address);
    if (result.error) {
      setErrorMsg(result.error);
      setStatus("error");
    } else {
      setStatus("idle");
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${
          hasCoords
            ? "bg-green-100 text-green-700"
            : "bg-background border border-border text-foreground/40"
        }`}
      >
        {hasCoords ? "⭐ On live map" : "Not located"}
      </span>
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "loading"}
        className="text-xs text-accent font-medium hover:underline disabled:opacity-50"
      >
        {status === "loading" ? "Locating…" : hasCoords ? "Re-locate" : "Locate"}
      </button>
      {status === "error" && errorMsg && (
        <span className="text-[11px] text-red-600">{errorMsg}</span>
      )}
    </div>
  );
}