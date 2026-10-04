import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOutOfPortal } from "@/app/actions";

// Customer-facing layout. Deliberately has no links into the internal ops
// pages (Vehicles/Routes/Deliver/Proof of Delivery) — see the note in
// src/app/(ops)/layout.tsx for why that separation matters.
export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <header className="border-b border-border bg-white">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between gap-3 min-w-0">
          <Link href="/portal" className="font-bold text-lg text-accent shrink-0">
            Routed
          </Link>
          {user && (
            <nav className="flex items-center gap-3 sm:gap-6 text-sm font-medium text-foreground/70 min-w-0">
              <Link href="/portal" className="hover:text-accent whitespace-nowrap">
                Dashboard
              </Link>
              <Link href="/portal/deliveries" className="hover:text-accent whitespace-nowrap">
                <span className="sm:hidden">Deliveries</span>
                <span className="hidden sm:inline">Proof of Delivery</span>
              </Link>
              <span className="text-foreground/40 hidden sm:inline truncate">
                {user.email}
              </span>
              <form action={signOutOfPortal} className="shrink-0">
                <button type="submit" className="hover:text-accent whitespace-nowrap">
                  Sign out
                </button>
              </form>
            </nav>
          )}
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-8">
        {children}
      </main>
    </>
  );
}
