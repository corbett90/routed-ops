"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------
export async function createVehicle(formData: FormData) {
  const supabase = await createClient();

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
  const supabase = await createClient();
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
  const supabase = await createClient();

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
  const supabase = await createClient();

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

export async function assignVehicleToRoute(routeId: string, vehicleId: string) {
  const supabase = await createClient();

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
