import { createClient } from "@/lib/supabase/server";
import type { DeliveryWithContext } from "@/lib/types";

// Proof of Delivery, On Demand — search by PO number or store name.
// Filtering happens in-app (below) rather than as a Postgres/PostgREST query
// across the joined route_stops table, which keeps this simple and reliable
// at small fleet scale. If the delivery volume grows enough that pulling the
// last 200 records stops being "recent enough", swap this for a real
// full-text search (Postgres `tsvector` column + index) rather than raising
// the limit indefinitely.
export default async function DeliveriesPage(
  props: PageProps<"/deliveries">
) {
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deliveries")
    .select("*, route_stops(*), routes(*)")
    .eq("status", "delivered")
    .order("delivered_at", { ascending: false })
    .limit(200);

  const deliveries = (data ?? []) as DeliveryWithContext[];

  const filtered = query
    ? deliveries.filter((d) => {
        const haystack = [
          d.po_number,
          d.bol_number,
          d.route_stops?.store_name,
          d.routes?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(query.toLowerCase());
      })
    : deliveries;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Proof of Delivery</h1>
        <p className="text-foreground/60 mt-1">
          Search by PO number or store — every drop is timestamped and photo/signature-backed.
        </p>
      </div>

      <form className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search by PO number or store…"
          className="flex-1 rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
        />
        <button
          type="submit"
          className="rounded-md bg-accent text-white text-sm font-medium px-4 py-2"
        >
          Search
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          Couldn&apos;t load deliveries: {error.message}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filtered.length > 0 ? (
          filtered.map((d) => (
            <div key={d.id} className="rounded-lg border border-border bg-white p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">
                    {d.route_stops?.store_name ?? "Unknown store"}
                  </div>
                  <div className="text-sm text-foreground/60">
                    {d.routes?.name}
                    {d.po_number ? ` · PO ${d.po_number}` : ""}
                    {d.bol_number ? ` · BOL ${d.bol_number}` : ""}
                  </div>
                </div>
                <span className="text-xs font-medium rounded-full bg-green-100 text-green-700 px-3 py-1 shrink-0">
                  Delivered
                </span>
              </div>

              <div className="text-xs text-foreground/50">
                {d.delivered_at &&
                  new Date(d.delivered_at).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    // This page renders on the server (Vercel runs in UTC),
                    // not in the driver's/viewer's browser, so without this
                    // the displayed time is whatever the server's clock
                    // says, not the reader's local time. Routed operates
                    // only in the Marietta/Cobb County, GA area, so Eastern
                    // is hardcoded here rather than detected — revisit if
                    // routes ever run in another time zone.
                    timeZone: "America/New_York",
                    timeZoneName: "short",
                  })}
                {d.driver_name ? ` · ${d.driver_name}` : ""}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {d.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={d.photo_url}
                    alt="Delivery photo"
                    className="rounded-md border border-border h-24 w-full object-cover"
                  />
                )}
                {d.signature_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={d.signature_url}
                    alt="Signature"
                    className="rounded-md border border-border h-24 w-full object-contain bg-white"
                  />
                )}
              </div>
            </div>
          ))
        ) : (
          !error && (
            <p className="text-sm text-foreground/50 sm:col-span-2">
              {query
                ? `No deliveries match "${query}".`
                : "No deliveries logged yet."}
            </p>
          )
        )}
      </div>
    </div>
  );
}
