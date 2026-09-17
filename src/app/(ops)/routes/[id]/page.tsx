import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RouteWithDetails, Vehicle } from "@/lib/types";
import {
  addRouteStop,
  assignVehicleToRoute,
  grantStoreAccess,
  moveRouteStop,
  revokeStoreAccess,
  setStopScheduledTime,
} from "@/app/actions";
import { LocateStopButton } from "./LocateStopButton";

export default async function RouteDetailPage(
  props: PageProps<"/routes/[id]">
) {
  const { id } = await props.params;
  const supabase = createAdminClient();

  const { data: route } = await supabase
    .from("routes")
    .select(
      "*, route_stops(*, store_access(*)), route_assignments(*, vehicles(*))"
    )
    .eq("id", id)
    .order("sequence_order", { referencedTable: "route_stops" })
    .single();

  if (!route) notFound();

  const typedRoute = route as RouteWithDetails;
  const activeAssignment = typedRoute.route_assignments?.find((a) => a.is_active);
  const sortedStops = typedRoute.route_stops
    ? [...typedRoute.route_stops].sort((a, b) => a.sequence_order - b.sequence_order)
    : [];

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
        <div className="space-y-3">
          {sortedStops.map((stop, index) => (
            <div
              key={stop.id}
              className="rounded-md border border-border px-3 py-3 text-sm space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col shrink-0">
                  <form
                    action={async () => {
                      "use server";
                      await moveRouteStop(id, stop.id, "up");
                    }}
                  >
                    <button
                      type="submit"
                      disabled={index === 0}
                      aria-label={`Move ${stop.store_name} up`}
                      className="flex h-4 w-6 items-center justify-center text-foreground/40 hover:text-accent disabled:opacity-20 disabled:hover:text-foreground/40"
                    >
                      ▲
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await moveRouteStop(id, stop.id, "down");
                    }}
                  >
                    <button
                      type="submit"
                      disabled={index === sortedStops.length - 1}
                      aria-label={`Move ${stop.store_name} down`}
                      className="flex h-4 w-6 items-center justify-center text-foreground/40 hover:text-accent disabled:opacity-20 disabled:hover:text-foreground/40"
                    >
                      ▼
                    </button>
                  </form>
                </div>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft/40 text-accent font-semibold text-xs">
                  {stop.sequence_order}
                </span>
                <div>
                  <div className="font-medium">{stop.store_name}</div>
                  {stop.address && (
                    <div className="text-foreground/50">{stop.address}</div>
                  )}
                </div>
              </div>

              <div className="pl-9">
                <LocateStopButton
                  routeId={id}
                  stopId={stop.id}
                  address={stop.address}
                  hasCoords={stop.lat !== null && stop.lng !== null}
                />
              </div>

              <div className="pl-9 flex flex-wrap items-end gap-6">
                <form
                  action={async (formData) => {
                    "use server";
                    await setStopScheduledTime(id, stop.id, formData);
                  }}
                  className="flex items-end gap-2"
                >
                  <label className="text-xs">
                    <span className="block text-foreground/60 mb-1">
                      Scheduled arrival
                    </span>
                    <input
                      type="time"
                      name="scheduled_time"
                      defaultValue={stop.scheduled_time?.slice(0, 5) ?? ""}
                      className="rounded-md border border-border px-2 py-1 text-sm"
                    />
                  </label>
                  <button
                    type="submit"
                    className="text-xs text-accent font-medium hover:underline pb-1.5"
                  >
                    Save
                  </button>
                </form>

                <div className="flex-1 min-w-52">
                  <span className="block text-xs text-foreground/60 mb-1">
                    Customer portal access
                  </span>
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {stop.store_access?.map((access) => (
                      <span
                        key={access.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-background border border-border px-2.5 py-1 text-xs"
                      >
                        {access.email}
                        <form
                          action={async () => {
                            "use server";
                            await revokeStoreAccess(id, access.id);
                          }}
                        >
                          <button
                            type="submit"
                            aria-label={`Remove access for ${access.email}`}
                            className="text-foreground/40 hover:text-red-600"
                          >
                            &times;
                          </button>
                        </form>
                      </span>
                    ))}
                    {(!stop.store_access || stop.store_access.length === 0) && (
                      <span className="text-xs text-foreground/40">
                        No customer logins yet.
                      </span>
                    )}
                  </div>
                  <form
                    action={async (formData) => {
                      "use server";
                      await grantStoreAccess(id, stop.id, formData);
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="store-contact@client.com"
                      className="flex-1 rounded-md border border-border px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-accent-soft"
                    />
                    <button
                      type="submit"
                      className="text-xs text-accent font-medium hover:underline"
                    >
                      Grant access &amp; invite
                    </button>
                  </form>
                  <p className="text-[11px] text-foreground/40 mt-1">
                    Sends them an email to set up their portal password.
                  </p>
                </div>
              </div>
            </div>
          ))}
          {sortedStops.length === 0 && (
            <p className="text-sm text-foreground/50">No stops added yet.</p>
          )}
        </div>

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