import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The link in a Supabase magic-link email points here with a one-time
// `code` query param. Exchanging it for a session is what actually logs
// the store in — this sets the auth cookies the portal pages then read.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/portal";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/portal/login?error=Could not sign in — the link may have expired`
  );
}
