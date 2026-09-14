import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RouteWithDetails } from "@/lib/types";
import { createRoute } from "@/app/actions";

export default async function RoutesPage() {
  const supabase = createAdminClient();
  const { data: routes, error } = await supabase
    .from("routes")
    .select(
      "*, route_stops(*), route_assignments(*, vehicles(*))"
    )
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Routes</h1>
        <p className="text-foreground/60 mt-1">
          Each route has a fixed sequence of stops and one dedicated vehicle.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          Couldn&apos;t load routes: {error.message}.
        </p>
      )}

      <div className="rounded-lg border border-border bg-white divide-y divide-border">
        {routes && routes.length > 0 ? (
          (routes as RouteWithDetails[]).map((r) => {
            const activeAssignment = r.route_assignments?.find((a) => a.is_active);
            return (
              <Link
                key={r.id}
                href={`/routes/${r.id}`}
                className="p-4 flex items-center justify-between hover:bg-background/60"
              >
                <div>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-sm text-foreground/60">
                    {r.client_name} · {r.route_stops?.length ?? 0} stops · {r.runs_per_day}x/day
                  </div>
                </div>
                <div className="text-sm">
                  {activeAssignment?.vehicles ? (
                    <span className="rounded-full bg-accent-soft/40 text-accent px-3 py-1 font-medium">
                      {activeAssignment.vehicles.name}
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 text-gray-500 px-3 py-1">
                      No vehicle assigned
                    </span>
                  )}
                </div>
              </Link>
            );
          })
        ) : (
          !error && (
            <p className="p-6 text-sm text-foreground/50">
              No routes yet — add the first one below.
            </p>
          )
        )}
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        <h2 className="font-semibold mb-4">Add a route</h2>
        <form action={createRoute} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Route name" name="name" placeholder="Route 4" required />
          <Field
            label="Client"
            name="client_name"
            placeholder="NAPA Auto Parts - Cobb County"
            required
          />
          <Field label="Runs per day" name="runs_per_day" type="number" placeholder="4" />
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-accent text-white text-sm font-medium px-4 py-2 hover:opacity-90"
            >
              Create route
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
