import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Route } from "@/lib/types";

export default async function DeliverRoutePickerPage() {
  const supabase = createAdminClient();
  const { data: routes, error } = await supabase
    .from("routes")
    .select("*")
    .eq("status", "active")
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Start a Delivery</h1>
        <p className="text-foreground/60 mt-1">Pick the route you&apos;re running.</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          Couldn&apos;t load routes: {error.message}
        </p>
      )}

      <div className="rounded-lg border border-border bg-white divide-y divide-border">
        {routes && routes.length > 0 ? (
          (routes as Route[]).map((r) => (
            <Link
              key={r.id}
              href={`/deliver/${r.id}`}
              className="p-5 flex items-center justify-between hover:bg-background/60 active:bg-background"
            >
              <div>
                <div className="font-semibold text-lg">{r.name}</div>
                <div className="text-sm text-foreground/60">{r.client_name}</div>
              </div>
              <span className="text-accent text-2xl">&rarr;</span>
            </Link>
          ))
        ) : (
          !error && (
            <p className="p-6 text-sm text-foreground/50">
              No active routes yet. Add one from the Routes screen first.
            </p>
          )
        )}
      </div>
    </div>
  );
}
