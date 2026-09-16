import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOutStaff } from "@/app/actions";

// Layout for the internal ops pages only (Vehicles, Routes, Deliver, Proof
// of Delivery, Staff). Deliberately separate from the customer portal's
// layout (src/app/portal/layout.tsx) so a customer never sees links into
// the internal admin screens — those screens use the service-role key and
// show every customer's data, not just the logged-in customer's own.
//
// These pages are gated by proxy.ts (requires a signed-in user with a row
// in staff_access) — see migration 0005 and src/proxy.ts. The "Staff" nav
// link only shows for admins; the /staff page itself enforces that too,
// so this is just to avoid showing a link a driver can't use.
export default async function OpsLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: staffRow } = user
    ? await supabase
        .from("staff_access")
        .select("role")
        .eq("email", user.email!.toLowerCase())
        .maybeSingle()
    : { data: null };

  const isAdmin = staffRow?.role === "admin";

  return (
    <>
      <header className="border-b border-border bg-white">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg text-accent">
            Routed Ops
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium text-foreground/70">
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
            {isAdmin && (
              <Link href="/staff" className="hover:text-accent">
                Staff
              </Link>
            )}
            {user && (
              <>
                <span className="text-foreground/40 hidden sm:inline">
                  {user.email}
                </span>
                <form action={signOutStaff}>
                  <button type="submit" className="hover:text-accent">
                    Sign out
                  </button>
                </form>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-8">
        {children}
      </main>
    </>
  );
}
