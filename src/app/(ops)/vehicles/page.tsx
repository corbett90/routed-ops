import { createAdminClient } from "@/lib/supabase/admin";
import type { Vehicle } from "@/lib/types";
import { createVehicle, updateVehicleStatus } from "@/app/actions";

const STATUS_STYLES: Record<Vehicle["status"], string> = {
  active: "bg-green-100 text-green-700",
  maintenance: "bg-amber-100 text-amber-700",
  retired: "bg-gray-200 text-gray-600",
};

export default async function VehiclesPage() {
  const supabase = createAdminClient();
  const { data: vehicles, error } = await supabase
    .from("vehicles")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Vehicles</h1>
        <p className="text-foreground/60 mt-1">The fleet available to assign to routes.</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          Couldn&apos;t load vehicles: {error.message}. Make sure the Supabase
          env vars are set and the migration has been run.
        </p>
      )}

      <div className="rounded-lg border border-border bg-white divide-y divide-border">
        {vehicles && vehicles.length > 0 ? (
          (vehicles as Vehicle[]).map((v) => (
            <div key={v.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{v.name}</div>
                <div className="text-sm text-foreground/60">
                  {v.vehicle_type}
                  {v.make ? ` · ${v.make} ${v.model ?? ""}`.trimEnd() : ""}
                  {v.license_plate ? ` · Plate ${v.license_plate}` : ""}
                </div>
              </div>
              <form
                action={async (formData) => {
                  "use server";
                  await updateVehicleStatus(v.id, String(formData.get("status")));
                }}
                className="flex items-center gap-2"
              >
                <select
                  name="status"
                  defaultValue={v.status}
                  className={`text-xs font-medium rounded-full px-3 py-1 border-0 ${STATUS_STYLES[v.status]}`}
                >
                  <option value="active">active</option>
                  <option value="maintenance">maintenance</option>
                  <option value="retired">retired</option>
                </select>
                <button
                  type="submit"
                  className="text-xs text-accent font-medium hover:underline"
                >
                  Update
                </button>
              </form>
            </div>
          ))
        ) : (
          !error && (
            <p className="p-6 text-sm text-foreground/50">
              No vehicles yet — add the first one below.
            </p>
          )
        )}
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        <h2 className="font-semibold mb-4">Add a vehicle</h2>
        <form action={createVehicle} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Name" name="name" placeholder="Model 3 - Route 4" required />
          <Field label="Type" name="vehicle_type" placeholder="sedan" required />
          <Field label="Make" name="make" placeholder="Tesla" />
          <Field label="Model" name="model" placeholder="Model 3" />
          <Field label="Year" name="year" type="number" placeholder="2026" />
          <Field label="License plate" name="license_plate" placeholder="ABC1234" />
          <Field label="VIN" name="vin" placeholder="5YJ3..." />
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-accent text-white text-sm font-medium px-4 py-2 hover:opacity-90"
            >
              Add vehicle
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="text-sm">
      <span className="block text-foreground/70 mb-1">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
      />
    </label>
  );
}
