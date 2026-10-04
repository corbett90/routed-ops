import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { DeliveryForm } from "./DeliveryForm";

export default async function DeliverCapturePage(
  props: PageProps<"/deliver/[routeId]/[stopId]">
) {
  const { routeId, stopId } = await props.params;
  const supabase = createAdminClient();

  const { data: stop } = await supabase
    .from("route_stops")
    .select("*")
    .eq("id", stopId)
    .eq("route_id", routeId)
    .single();

  if (!stop) notFound();

  const { data: assignment } = await supabase
    .from("route_assignments")
    .select("vehicle_id")
    .eq("route_id", routeId)
    .eq("is_active", true)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/deliver/${routeId}`}
          className="text-sm text-accent hover:underline"
        >
          &larr; Stops
        </Link>
        <h1 className="text-2xl font-bold mt-2">{stop.store_name}</h1>
        {stop.address && <p className="text-foreground/60 mt-1">{stop.address}</p>}
      </div>

      {stop.driver_instructions && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">
            Delivery instructions
          </h2>
          <p className="text-sm text-amber-900/80 mt-1 whitespace-pre-wrap">
            {stop.driver_instructions}
          </p>
        </div>
      )}

      <DeliveryForm
        routeId={routeId}
        stopId={stopId}
        vehicleId={assignment?.vehicle_id ?? null}
      />
    </div>
  );
}
