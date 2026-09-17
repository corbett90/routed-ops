"use server";


import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://routed-ops.vercel.app";

// ---------------------------------------------------------------------------
// Customer portal auth (email + password). Accounts are NOT self-service —
// a store only gets one when Routed invites them (see grantStoreAccess
// below), which emails them a one-time link to set their own password.
// From then on they sign in with that email + password directly, no link
// needed each time. Sign-in itself uses the regular anon-key, cookie-aware
// client, NOT the admin client — this is a real user-facing login, so it
// goes through Supabase Auth + RLS like any normal signed-in request would.
// ---------------------------------------------------------------------------
export async function signInToPortal(
  formData: FormData
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Incorrect email or password." };

  redirect("/portal");
}

export async function requestPortalPasswordReset(
  formData: FormData
): Promise<{ error?: string; sent?: boolean }> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${SITE_URL}/auth/callback?next=/portal/set-password`,
  });

  if (error) return { error: error.message };
  return { sent: true };
}

export async function setPortalPassword(
  formData: FormData
): Promise<{ error?: string }> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/portal");
}

export async function signOutOfPortal() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/portal/login");
}

// ---------------------------------------------------------------------------
// Staff auth (email + password) — gates the internal ops pages (Vehicles,
// Routes, Deliver, Proof of Delivery). Same shape as the customer portal's
// auth above (accounts are invite-only via addStaffAccess below, not
// self-service), kept as separate functions so each login area's redirect
// targets stay simple and explicit. The actual access boundary lives in
// proxy.ts, which checks staff_access — not RLS, since these pages read
// via the service-role admin client.
// ---------------------------------------------------------------------------
export async function signInStaff(
  formData: FormData
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Incorrect email or password." };

  redirect("/");
}

export async function requestStaffPasswordReset(
  formData: FormData
): Promise<{ error?: string; sent?: boolean }> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${SITE_URL}/auth/callback?next=/staff/set-password`,
  });

  if (error) return { error: error.message };
  return { sent: true };
}

export async function setStaffPassword(
  formData: FormData
): Promise<{ error?: string }> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/");
}

export async function signOutStaff() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/staff/login");
}

// ---------------------------------------------------------------------------
// Staff management (admin-only — enforced by the caller/page, not here;
// see src/app/(ops)/staff/page.tsx).
// ---------------------------------------------------------------------------
export async function addStaffAccess(formData: FormData) {
  const supabase = createAdminClient();
  const email = String(formData.get("email")).trim().toLowerCase();
  const role = String(formData.get("role") ?? "driver");

  const { error } = await supabase
    .from("staff_access")
    .insert({ email, role });

  // A duplicate (email already staff) isn't worth surfacing as an error.
  if (error && error.code !== "23505") throw new Error(error.message);

  // Invite them so they can set a password — same invite-only pattern as
  // grantStoreAccess. If they already have an account (e.g. they already
  // have customer portal access under the same email), Supabase returns
  // an "already registered" error here, which is expected and swallowed.
  await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${SITE_URL}/auth/callback?next=/staff/set-password`,
  });

  revalidatePath("/staff");
}

export async function removeStaffAccess(staffAccessId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("staff_access")
    .delete()
    .eq("id", staffAccessId);

  if (error) throw new Error(error.message);
  revalidatePath("/staff");
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------
export async function createVehicle(formData: FormData) {
  const supabase = createAdminClient();

  const { error } = await supabase.from("vehicles").insert({
    name: String(formData.get("name")),
    vehicle_type: String(formData.get("vehicle_type")),
    make: formData.get("make") ? String(formData.get("make")) : null,
    model: formData.get("model") ? String(formData.get("model")) : null,
    year: formData.get("year") ? Number(formData.get("year")) : null,
    license_plate: formData.get("license_plate")
      ? String(formData.get("license_plate"))
      : null,
    vin: formData.get("vin") ? String(formData.get("vin")) : null,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/vehicles");
}

export async function updateVehicleStatus(vehicleId: string, status: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("vehicles")
    .update({ status })
    .eq("id", vehicleId);

  if (error) throw new Error(error.message);
  revalidatePath("/vehicles");
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
export async function createRoute(formData: FormData) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("routes")
    .insert({
      name: String(formData.get("name")),
      client_name: String(formData.get("client_name")),
      runs_per_day: Number(formData.get("runs_per_day") || 1),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/routes");
  redirect(`/routes/${data.id}`);
}

// ---------------------------------------------------------------------------
// Geocoding — turns a typed address into a lat/lng so a stop can be plotted
// as a star on the live map (see src/app/(ops)/track). Uses OpenStreetMap's
// free Nominatim geocoder — no API key, same underlying data source as the
// map tiles the live map already uses. Nominatim's usage policy requires a
// real identifying User-Agent for non-browser callers and asks for at most
// ~1 request/second, both fine for how rarely stops get added here.
//
// Failure is never fatal — a stop that can't be geocoded (bad address, the
// service being down, no address given at all) still gets created, just
// without coordinates. It simply won't show up on the live map until
// someone clicks "Locate" on it (see regeocodeStop below) with a workable
// address.
// ---------------------------------------------------------------------------
async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
      address
    )}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "routed-ops (sales@routedparts.com)" },
    });
    if (!response.ok) return null;

    const results = (await response.json()) as { lat: string; lon: string }[];
    const first = results[0];
    if (!first) return null;

    return { lat: Number(first.lat), lng: Number(first.lon) };
  } catch {
    return null;
  }
}

export async function addRouteStop(routeId: string, formData: FormData) {
  const supabase = createAdminClient();

  // Next sequence order = current max + 1
  const { data: existing } = await supabase
    .from("route_stops")
    .select("sequence_order")
    .eq("route_id", routeId)
    .order("sequence_order", { ascending: false })
    .limit(1);

  const nextSeq = existing && existing.length > 0 ? existing[0].sequence_order + 1 : 1;

  const address = formData.get("address") ? String(formData.get("address")) : null;
  const coords = address ? await geocodeAddress(address) : null;

  const { error } = await supabase.from("route_stops").insert({
    route_id: routeId,
    store_name: String(formData.get("store_name")),
    address,
    sequence_order: nextSeq,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/routes/${routeId}`);
}

// Backfills coordinates for a stop that was added before geocoding existed,
// or whose address didn't resolve the first time (e.g. a typo since fixed).
// Surfaces success/failure so the "Locate" button on the Routes page can
// tell the person what happened rather than failing silently.
export async function regeocodeStop(
  routeId: string,
  stopId: string,
  address: string
): Promise<{ error?: string }> {
  const coords = await geocodeAddress(address);
  if (!coords) {
    return {
      error:
        "Couldn't find coordinates for that address — double-check it's a full, correct address.",
    };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("route_stops")
    .update({ lat: coords.lat, lng: coords.lng })
    .eq("id", stopId);

  if (error) return { error: error.message };

  revalidatePath(`/routes/${routeId}`);
  revalidatePath("/track");
  return {};
}

// Edits a stop's typed address (e.g. fixing a typo that failed to geocode)
// and re-geocodes it in the same step, so there's no separate "save" then
// "locate" click needed. If the new address doesn't resolve, the address
// text is still saved — only the coordinates are left as they were (or
// null, if there weren't any yet) — same "never block on a bad address"
// behavior as addRouteStop/regeocodeStop above.
export async function updateStopAddress(
  routeId: string,
  stopId: string,
  address: string
): Promise<{ error?: string }> {
  const trimmed = address.trim();
  if (!trimmed) return { error: "Address can't be empty." };

  const coords = await geocodeAddress(trimmed);

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("route_stops")
    .update({
      address: trimmed,
      ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
    })
    .eq("id", stopId);

  if (error) return { error: error.message };

  revalidatePath(`/routes/${routeId}`);
  revalidatePath("/track");

  if (!coords) {
    return {
      error:
        "Address saved, but couldn't find coordinates for it — double-check it's a full, correct address.",
    };
  }
  return {};
}

// Reorders a stop by swapping its sequence_order with its immediate
// neighbor (up = earlier in the route, down = later). A pair of up/down
// buttons is simpler and far less error-prone to build — and to paste
// through github.dev — than a drag-and-drop widget, and routes here
// typically only have a handful of stops.
//
// The swap goes through a temporary out-of-range value first (rather than
// updating the two rows directly to each other's values) in case
// sequence_order ever gets a per-route uniqueness constraint — without
// that, the middle of a direct swap would briefly have two stops sharing
// the same order.
export async function moveRouteStop(
  routeId: string,
  stopId: string,
  direction: "up" | "down"
) {
  const supabase = createAdminClient();

  const { data: stops, error: fetchError } = await supabase
    .from("route_stops")
    .select("id, sequence_order")
    .eq("route_id", routeId)
    .order("sequence_order", { ascending: true });

  if (fetchError) throw new Error(fetchError.message);
  if (!stops) return;

  const index = stops.findIndex((s) => s.id === stopId);
  if (index === -1) return;

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= stops.length) return;

  const current = stops[index];
  const neighbor = stops[swapIndex];
  const TEMP_ORDER = -1;

  let { error } = await supabase
    .from("route_stops")
    .update({ sequence_order: TEMP_ORDER })
    .eq("id", current.id);
  if (error) throw new Error(error.message);

  ({ error } = await supabase
    .from("route_stops")
    .update({ sequence_order: current.sequence_order })
    .eq("id", neighbor.id));
  if (error) throw new Error(error.message);

  ({ error } = await supabase
    .from("route_stops")
    .update({ sequence_order: neighbor.sequence_order })
    .eq("id", current.id));
  if (error) throw new Error(error.message);

  revalidatePath(`/routes/${routeId}`);
}

export async function setStopScheduledTime(
  routeId: string,
  stopId: string,
  formData: FormData
) {
  const supabase = createAdminClient();
  const scheduledTime = formData.get("scheduled_time")
    ? String(formData.get("scheduled_time"))
    : null;

  const { error } = await supabase
    .from("route_stops")
    .update({ scheduled_time: scheduledTime })
    .eq("id", stopId);

  if (error) throw new Error(error.message);
  revalidatePath(`/routes/${routeId}`);
}

export async function grantStoreAccess(
  routeId: string,
  stopId: string,
  formData: FormData
) {
  const supabase = createAdminClient();
  const email = String(formData.get("email")).trim().toLowerCase();

  const { error } = await supabase
    .from("store_access")
    .insert({ route_stop_id: stopId, email });

  // A duplicate grant (same email already added to this stop) isn't an
  // error worth surfacing — treat it as a no-op.
  if (error && error.code !== "23505") throw new Error(error.message);

  // Invite this email so they can set a password and log in — this is how
  // portal accounts get created; there's no self-service signup. If they
  // already have an account (e.g. they already have access to another
  // stop), Supabase returns an "already registered" error here, which is
  // expected, not a failure, so it's swallowed rather than thrown.
  await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${SITE_URL}/auth/callback?next=/portal/set-password`,
  });

  revalidatePath(`/routes/${routeId}`);
}

export async function revokeStoreAccess(routeId: string, storeAccessId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("store_access")
    .delete()
    .eq("id", storeAccessId);

  if (error) throw new Error(error.message);
  revalidatePath(`/routes/${routeId}`);
}

export async function assignVehicleToRoute(routeId: string, vehicleId: string) {
  const supabase = createAdminClient();

  // Close out any currently active assignment for this route
  await supabase
    .from("route_assignments")
    .update({ is_active: false, unassigned_at: new Date().toISOString() })
    .eq("route_id", routeId)
    .eq("is_active", true);

  const { error } = await supabase.from("route_assignments").insert({
    route_id: routeId,
    vehicle_id: vehicleId,
    is_active: true,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/routes/${routeId}`);
  revalidatePath("/routes");
}

// ---------------------------------------------------------------------------
// Driver capture — "No Paperwork Headaches" + "Proof of Delivery"
// One submission covers both: the PO/BOL photo and signature ARE the digital
// paperwork, and the same record IS the proof-of-delivery entry.
// ---------------------------------------------------------------------------
export async function createDeliveryCapture(formData: FormData) {
  const supabase = createAdminClient();

  const routeId = String(formData.get("route_id"));
  const routeStopId = String(formData.get("route_stop_id"));
  const vehicleId = formData.get("vehicle_id")
    ? String(formData.get("vehicle_id"))
    : null;
  const driverName = formData.get("driver_name")
    ? String(formData.get("driver_name"))
    : null;
  const poNumber = formData.get("po_number")
    ? String(formData.get("po_number"))
    : null;
  const bolNumber = formData.get("bol_number")
    ? String(formData.get("bol_number"))
    : null;
  const lat = formData.get("lat") ? Number(formData.get("lat")) : null;
  const lng = formData.get("lng") ? Number(formData.get("lng")) : null;
  const signatureDataUrl = formData.get("signature_data")
    ? String(formData.get("signature_data"))
    : null;
  const photo = formData.get("photo") as File | null;

  const deliveryId = crypto.randomUUID();
  let photoUrl: string | null = null;
  let signatureUrl: string | null = null;

  if (photo && photo.size > 0) {
    const ext = photo.name.split(".").pop() || "jpg";
    const path = `${deliveryId}/photo.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("delivery-media")
      .upload(path, photo, { contentType: photo.type || "image/jpeg" });
    if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);
    photoUrl = supabase.storage.from("delivery-media").getPublicUrl(path).data
      .publicUrl;
  }

  if (signatureDataUrl && signatureDataUrl.startsWith("data:image")) {
    const base64 = signatureDataUrl.split(",")[1];
    const buffer = Buffer.from(base64, "base64");
    const path = `${deliveryId}/signature.png`;
    const { error: uploadError } = await supabase.storage
      .from("delivery-media")
      .upload(path, buffer, { contentType: "image/png" });
    if (uploadError)
      throw new Error(`Signature upload failed: ${uploadError.message}`);
    signatureUrl = supabase.storage.from("delivery-media").getPublicUrl(path)
      .data.publicUrl;
  }

  const { error } = await supabase.from("deliveries").insert({
    id: deliveryId,
    route_id: routeId,
    route_stop_id: routeStopId,
    vehicle_id: vehicleId,
    driver_name: driverName,
    po_number: poNumber,
    bol_number: bolNumber,
    status: "delivered",
    delivered_at: new Date().toISOString(),
    signature_url: signatureUrl,
    photo_url: photoUrl,
    delivered_lat: lat,
    delivered_lng: lng,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/deliver/${routeId}`);
  redirect(`/deliver/${routeId}/${routeStopId}/done`);
}

// ---------------------------------------------------------------------------
// Live tracking (concept/demo) — a driver's phone pushes a GPS breadcrumb
// every ~15s while a route is actively being driven (see RouteTracker.tsx,
// rendered on the /deliver/[routeId] stop list). Written via the admin
// client like every other ops write; migration 0006 is what lets a ping
// stand on its own against a route_id/vehicle_id instead of requiring a
// finished delivery row to attach to.
//
// Returns an error string instead of throwing so the client component can
// show it inline without crashing the tracking loop on one bad request.
// ---------------------------------------------------------------------------
export async function logLocationPing(
  formData: FormData
): Promise<{ error?: string }> {
  const routeId = formData.get("route_id") ? String(formData.get("route_id")) : null;
  const vehicleId = formData.get("vehicle_id")
    ? String(formData.get("vehicle_id"))
    : null;
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));

  if (!routeId || Number.isNaN(lat) || Number.isNaN(lng)) {
    return { error: "Missing route or location data." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("location_pings").insert({
    route_id: routeId,
    vehicle_id: vehicleId,
    lat,
    lng,
  });

  if (error) return { error: error.message };
  return {};
}