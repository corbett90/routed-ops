import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Server-only admin client using the service role key — bypasses Row Level
// Security entirely. This is what the INTERNAL ops pages (Vehicles, Routes,
// Deliver, Proof of Delivery) use, since the tables they read now have RLS
// enabled for the customer portal (see migration 0003) and no longer grant
// the anon key any access.
//
// SUPABASE_SERVICE_ROLE_KEY must never be prefixed with NEXT_PUBLIC_ and
// must never be referenced from a Client Component — it is a secret with
// full database access. This file is only ever imported from Server
// Components and Server Actions.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — the internal ops pages need both to read/write the database now that RLS is on."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
