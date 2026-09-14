import Link from "next/link";

// Layout for the internal ops pages only (Vehicles, Routes, Deliver, Proof
// of Delivery). Deliberately separate from the customer portal's layout
// (src/app/portal/layout.tsx) so a customer never sees links into the
// internal admin screens — those screens use the service-role key and
// show every customer's data, not just the logged-in customer's own.
//
// IMPORTANT: these pages still have no login of their own (see the setup
// guide's "known limitations" section) — anyone who has this URL can open
// them. That was an accepted trade-off while this was only Brad and his
// drivers; it's worth revisiting now that a real customer portal (with
// real access boundaries) exists side by side with it.
export default function OpsLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b border-border bg-white">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg text-accent">
            Routed Ops
          </Link>
          <nav className="flex gap-6 text-sm font-medium text-foreground/70">
            <Link href="/vehicles" className="hover:text-accent">
              Vehicles
            </Link>
            <Link href="/routes" className="hover:text-accent">
              Routes
            </Link>
            <Link href="/deliver" className="hover:text-accent">
              Deliver
            </Link>
            <Link href="/deliveries" className="hover:text-accent">
              Proof of Delivery
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-8">
        {children}
      </main>
    </>
  );
}
