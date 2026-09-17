"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { regeocodeStop, updateStopAddress } from "@/app/actions";

// Shows a stop's map-location status, and lets staff both retry geocoding
// ("Locate"/"Re-locate") and fix the underlying address itself ("Edit") —
// the two were split into separate features initially, but a bad/typo'd
// address needs editing, not just retrying, so both live here together.
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
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftAddress, setDraftAddress] = useState(address ?? "");

  async function handleLocateClick() {
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
      router.refresh();
    }
  }

  function startEditing() {
    setDraftAddress(address ?? "");
    setErrorMsg(null);
    setStatus("idle");
    setEditing(true);
  }

  async function handleSaveEdit() {
    setStatus("loading");
    setErrorMsg(null);

    const result = await updateStopAddress(routeId, stopId, draftAddress);
    if (result.error) {
      setErrorMsg(result.error);
      setStatus("error");
    } else {
      setStatus("idle");
    }
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={draftAddress}
          onChange={(e) => setDraftAddress(e.target.value)}
          placeholder="123 Main St, Marietta, GA"
          autoFocus
          className="flex-1 min-w-48 rounded-md border border-border px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-accent-soft"
        />
        <button
          type="button"
          onClick={handleSaveEdit}
          disabled={status === "loading"}
          className="text-xs text-accent font-medium hover:underline disabled:opacity-50"
        >
          {status === "loading" ? "Saving…" : "Save & locate"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-xs text-foreground/50 hover:underline"
        >
          Cancel
        </button>
      </div>
    );
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
        onClick={handleLocateClick}
        disabled={status === "loading"}
        className="text-xs text-accent font-medium hover:underline disabled:opacity-50"
      >
        {status === "loading" ? "Locating…" : hasCoords ? "Re-locate" : "Locate"}
      </button>
      <button
        type="button"
        onClick={startEditing}
        className="text-xs text-foreground/50 hover:underline"
      >
        Edit address
      </button>
      {status === "error" && errorMsg && (
        <span className="text-[11px] text-red-600">{errorMsg}</span>
      )}
    </div>
  );
}