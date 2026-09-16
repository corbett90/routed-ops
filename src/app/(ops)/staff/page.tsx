import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { addStaffAccess, removeStaffAccess } from "@/app/actions";

// Admin-only: invite/remove staff logins (see migration 0005 +
// src/proxy.ts, which is what actually gates every ops page — this page
// additionally restricts itself to role='admin', since any staff member
// reaching this URL has already passed proxy's "are you staff at all"
// check, but not every staff member should be able to add/remove others.
export default async function StaffPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();

  const { data: currentStaffRow } = await admin
    .from("staff_access")
    .select("role")
    .eq("email", user?.email?.toLowerCase() ?? "")
    .maybeSingle();

  if (currentStaffRow?.role !== "admin") {
    return (
      <div className="rounded-lg border border-border bg-white p-5">
        <p className="text-sm text-foreground/60">
          Only admins can manage staff access.
        </p>
      </div>
    );
  }

  const { data: staff } = await admin
    .from("staff_access")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Staff</h1>
        <p className="text-foreground/60 mt-1">
          Who can sign in to the ops pages (Vehicles, Routes, Deliver, Proof
          of Delivery).
        </p>
      </div>

      <section className="rounded-lg border border-border bg-white p-5 space-y-4">
        <h2 className="font-semibold">Current staff</h2>
        <div className="space-y-2">
          {(staff ?? []).map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium">{s.email}</span>{" "}
                <span className="text-foreground/50">
                  ·{" "}
                  {s.role === "admin" ? "Admin" : "Driver"}
                </span>
              </div>
              {s.email !== user?.email?.toLowerCase() && (
                <form
                  action={async () => {
                    "use server";
                    await removeStaffAccess(s.id);
                  }}
                >
                  <button
                    type="submit"
                    className="text-foreground/40 hover:text-red-600 text-xs"
                  >
                    Remove
                  </button>
                </form>
              )}
            </div>
          ))}
          {(!staff || staff.length === 0) && (
            <p className="text-sm text-foreground/50">No staff yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-white p-5 space-y-4">
        <h2 className="font-semibold">Add staff</h2>
        <form
          action={async (formData) => {
            "use server";
            await addStaffAccess(formData);
          }}
          className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end"
        >
          <label className="text-sm">
            <span className="block text-foreground/70 mb-1">Email</span>
            <input
              type="email"
              name="email"
              required
              placeholder="driver@routedparts.com"
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
            />
          </label>
          <label className="text-sm">
            <span className="block text-foreground/70 mb-1">Role</span>
            <select
              name="role"
              defaultValue="driver"
              className="rounded-md border border-border px-3 py-2 text-sm"
            >
              <option value="driver">Driver</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-accent text-white text-sm font-medium px-4 py-2 hover:opacity-90"
          >
            Add &amp; invite
          </button>
        </form>
        <p className="text-[11px] text-foreground/40">
          Sends them an email to set up their password (or grants access
          immediately if they already have an account).
        </p>
      </section>
    </div>
  );
}
