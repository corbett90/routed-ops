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

  const { error } = await supabase.from("route_stops").insert({
    route_id: routeId,
    store_name: String(formData.get("store_name")),
    address: formData.get("address") ? String(formData.get("address")) : null,
    sequence_order: nextSeq,
  });

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
