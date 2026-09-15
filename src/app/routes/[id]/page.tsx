import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RouteWithDetails, Vehicle } from "@/lib/types";
import { addRouteStop, assignVehicleToRoute } from "@/app/actions";

export default async function RouteDetailPage(
  props: PageProps<"/routes/[id]">
) {
  const { id } = await props.params;
  const supabase = await createClient();

  const { data: route } = await supabase
    .from("routes")
    .select("*, route_stops(*), route_assignments(*, vehicles(*))")
    .eq("id", id)
    .order("sequence_order", { referencedTable: "route_stops" })
    .single();

  if (!route) notFound();

  const typedRoute = route as RouteWithDetails;
  const activeAssignment = typedRoute.route_assignments?.find((a) => a.is_active);

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .eq("status", "active")
    .order("name");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{typedRoute.name}</h1>
        <p className="text-foreground/60 mt-1">
          {typedRoute.client_name} · {typedRoute.runs_per_day}x/day
        </p>
      </div>

      <section className="rounded-lg border border-border bg-white p-5 space-y-4">
        <h2 className="font-semibold">Assigned vehicle</h2>
        {activeAssignment?.vehicles ? (
          <p className="text-sm">
            <span className="rounded-full bg-accent-soft/40 text-accent px-3 py-1 font-medium">
              {activeAssignment.vehicles.name}
            </span>{" "}
            <span className="text-foreground/50">
              — assigned since{" "}
              {new Date(activeAssignment.assigned_at).toLocaleDateString("en-US", {
                timeZone: "America/New_York",
              })}
            </span>
          </p>
        ) : (
          <p className="text-sm text-foreground/50">No vehicle assigned yet.</p>
        )}

        <form
          action={async (formData) => {
            "use server";
            await assignVehicleToRoute(id, String(formData.get("vehicle_id")));
          }}
          className="flex items-end gap-3"
        >
          <label className="text-sm">
            <span className="block text-foreground/70 mb-1">
              {activeAssignment ? "Reassign to" : "Assign vehicle"}
            </span>
            <select
              name="vehicle_id"
              required
              className="rounded-md border border-border px-3 py-2 text-sm min-w-56"
              defaultValue=""
            >
              <option value="" disabled>
                Choose a vehicle
              </option>
              {(vehicles as Vehicle[] | null)?.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-accent text-white text-sm font-medium px-4 py-2 hover:opacity-90"
          >
            {activeAssignment ? "Reassign" : "Assign"}
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-white p-5 space-y-4">
        <h2 className="font-semibold">Stops (in order)</h2>
        <ol className="space-y-2">
          {typedRoute.route_stops
            ?.sort((a, b) => a.sequence_order - b.sequence_order)
            .map((stop) => (
              <li
                key={stop.id}
                className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft/40 text-accent font-semibold text-xs">
                  {stop.sequence_order}
                </span>
                <div>
                  <div className="font-medium">{stop.store_name}</div>
                  {stop.address && (
                    <div className="text-foreground/50">{stop.address}</div>
                  )}
                </div>
              </li>
            ))}
          {(!typedRoute.route_stops || typedRoute.route_stops.length === 0) && (
            <p className="text-sm text-foreground/50">No stops added yet.</p>
          )}
        </ol>

        <form
          action={async (formData) => {
            "use server";
            await addRouteStop(id, formData);
          }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2"
        >
          <label className="text-sm">
            <span className="block text-foreground/70 mb-1">Store name</span>
            <input
              name="store_name"
              placeholder="Auto Shop #402"
              required
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
            />
          </label>
          <label className="text-sm">
            <span className="block text-foreground/70 mb-1">Address</span>
            <input
              name="address"
              placeholder="123 Main St, Marietta, GA"
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-accent text-white text-sm font-medium px-4 py-2 hover:opacity-90"
            >
              Add stop
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
