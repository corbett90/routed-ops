import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client — anon key, real signed-in session (reads
// the same auth cookies the server side sets via src/lib/supabase/server.ts).
// This is the ONE place in the app that talks to Supabase directly from
// client-side code, and it's used for exactly one thing so far: the live
// map's Realtime subscription (src/app/(ops)/track/LiveMap.tsx), which has
// to run in the browser rather than on the server to get live updates.
//
// This client is subject to Row Level Security like any real user session —
// unlike the admin client (src/lib/supabase/admin.ts), which is server-only
// and bypasses RLS entirely. Never import this file's counterpart secret
// (SUPABASE_SERVICE_ROLE_KEY) anywhere near browser code.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}