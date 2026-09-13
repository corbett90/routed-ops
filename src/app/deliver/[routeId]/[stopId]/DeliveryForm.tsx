"use client";

import { useEffect, useRef, useState } from "react";
import { createDeliveryCapture } from "@/app/actions";

export function DeliveryForm({
  routeId,
  stopId,
  vehicleId,
}: {
  routeId: string;
  stopId: string;
  vehicleId: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const latInputRef = useRef<HTMLInputElement>(null);
  const lngInputRef = useRef<HTMLInputElement>(null);
  const drawingRef = useRef(false);

  const [hasSignature, setHasSignature] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    "pending" | "ok" | "unavailable"
  >("pending");
  const [submitting, setSubmitting] = useState(false);

  // Capture GPS as soon as the page opens so it's ready by the time the
  // driver finishes filling out the form — this is what feeds "Live
  // Tracking" and the delivered-location stamp later.
  useEffect(() => {
    if (!navigator.geolocation) {
      // Defer so we're not calling setState synchronously in the effect body.
      const timer = setTimeout(() => setLocationStatus("unavailable"), 0);
      return () => clearTimeout(timer);
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (latInputRef.current) latInputRef.current.value = String(pos.coords.latitude);
        if (lngInputRef.current) lngInputRef.current.value = String(pos.coords.longitude);
        setLocationStatus("ok");
      },
      () => setLocationStatus("unavailable"),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  function getCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawingRef.current = true;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getCanvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getCanvasPoint(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#10162a";
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function handlePointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    setHasSignature(true);
    if (canvasRef.current && signatureInputRef.current) {
      signatureInputRef.current.value = canvasRef.current.toDataURL("image/png");
    }
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    if (signatureInputRef.current) signatureInputRef.current.value = "";
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setPhotoPreview(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <form
      action={createDeliveryCapture}
      onSubmit={() => setSubmitting(true)}
      className="space-y-6"
    >
      <input type="hidden" name="route_id" value={routeId} />
      <input type="hidden" name="route_stop_id" value={stopId} />
      {vehicleId && <input type="hidden" name="vehicle_id" value={vehicleId} />}
      <input type="hidden" name="lat" ref={latInputRef} />
      <input type="hidden" name="lng" ref={lngInputRef} />
      <input type="hidden" name="signature_data" ref={signatureInputRef} />

      <div className="rounded-lg border border-border bg-white p-5 space-y-4">
        <h2 className="font-semibold">Driver &amp; paperwork</h2>
        <label className="block text-sm">
          <span className="block text-foreground/70 mb-1">Driver name</span>
          <input
            name="driver_name"
            required
            placeholder="Your name"
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="block text-foreground/70 mb-1">PO number</span>
            <input
              name="po_number"
              required
              placeholder="PO-48220"
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
            />
          </label>
          <label className="block text-sm">
            <span className="block text-foreground/70 mb-1">BOL number (optional)</span>
            <input
              name="bol_number"
              placeholder="BOL-2214"
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
            />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white p-5 space-y-3">
        <h2 className="font-semibold">Photo of PO / BOL / drop</h2>
        <input
          type="file"
          name="photo"
          accept="image/*"
          capture="environment"
          required
          onChange={handlePhotoChange}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-4 file:py-2 file:text-white file:text-sm file:font-medium"
        />
        {photoPreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoPreview}
            alt="Photo preview"
            className="rounded-md border border-border max-h-64 object-contain"
          />
        )}
      </div>

      <div className="rounded-lg border border-border bg-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Signature</h2>
          <button
            type="button"
            onClick={clearSignature}
            className="text-xs text-accent font-medium hover:underline"
          >
            Clear
          </button>
        </div>
        <canvas
          ref={canvasRef}
          width={600}
          height={180}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="w-full h-44 rounded-md border border-border bg-white touch-none"
        />
        {!hasSignature && (
          <p className="text-xs text-foreground/40">Sign above with a finger or mouse.</p>
        )}
      </div>

      <div className="text-xs text-foreground/50">
        {locationStatus === "pending" && "Getting your location…"}
        {locationStatus === "ok" && "Location captured."}
        {locationStatus === "unavailable" &&
          "Location unavailable — continuing without it."}
      </div>

      <button
        type="submit"
        disabled={!hasSignature || submitting}
        className="w-full rounded-md bg-accent text-white font-semibold py-3 disabled:opacity-40"
      >
        {submitting ? "Submitting…" : "Mark Delivered"}
      </button>
    </form>
  );
}
