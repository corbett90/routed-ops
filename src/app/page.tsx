import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Routed Ops Console</h1>
        <p className="text-foreground/60 mt-1">
          The operations backbone: vehicles, routes, stops, and vehicle-route
          assignments. Driver capture and live tracking build on top of this.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/vehicles"
          className="block rounded-lg border border-border bg-white p-5 hover:border-accent transition-colors"
        >
          <h2 className="font-semibold text-accent">Vehicles</h2>
          <p className="text-sm text-foreground/60 mt-1">
            Add and manage the fleet.
          </p>
        </Link>
        <Link
          href="/routes"
          className="block rounded-lg border border-border bg-white p-5 hover:border-accent transition-colors"
        >
          <h2 className="font-semibold text-accent">Routes</h2>
          <p className="text-sm text-foreground/60 mt-1">
            Define stops and assign a dedicated vehicle to each route.
          </p>
        </Link>
      </div>
    </div>
  );
}
