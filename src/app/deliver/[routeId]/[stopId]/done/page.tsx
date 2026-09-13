import Link from "next/link";

export default async function DeliveryDonePage(
  props: PageProps<"/deliver/[routeId]/[stopId]/done">
) {
  const { routeId } = await props.params;

  return (
    <div className="flex flex-col items-center text-center gap-4 py-16">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 text-3xl">
        ✓
      </div>
      <h1 className="text-2xl font-bold">Delivery logged</h1>
      <p className="text-foreground/60 max-w-sm">
        The photo, signature, and timestamp are saved. Proof of delivery is
        already searchable.
      </p>
      <Link
        href={`/deliver/${routeId}`}
        className="mt-2 rounded-md bg-accent text-white font-semibold px-6 py-3"
      >
        Next stop
      </Link>
    </div>
  );
}
