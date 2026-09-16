import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Next.js 16 renamed "middleware.ts" to "proxy.ts" (same mechanism, new
// name) — this runs before every matched request. Its job: keep the
// Supabase Auth session cookie fresh, and gate BOTH the customer portal
// (/portal/**) and the internal ops pages (everything else that isn't a
// public entry point) behind a logged-in session.
//
// /portal/** — any authenticated user may in; route_stops' own RLS
// (see migration 0004) is what actually restricts a customer to their own
// stop(s), not this proxy.
//
// Everything else (the (ops) route group: "/", /vehicles, /routes/**,
// /deliver/**, /deliveries) — an authenticated user AND a matching row in
// staff_access (checked here, since those pages read via the service-role
// admin client, which bypasses RLS entirely — this proxy check is the
// actual security boundary for them).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isPortalRoute = pathname.startsWith("/portal");
  const isPortalLoginRoute = pathname.startsWith("/portal/login");

  if (isPortalRoute) {
    if (!isPortalLoginRoute && !user) {
      return NextResponse.redirect(new URL("/portal/login", request.url));
    }
    return response;
  }

  // Public entry points for staff auth and the shared auth callback —
  // never gated, or nothing could ever log in in the first place.
  const isPublicStaffRoute =
    pathname.startsWith("/staff/login") ||
    pathname.startsWith("/staff/set-password") ||
    pathname.startsWith("/auth");

  if (isPublicStaffRoute) {
    return response;
  }

  // Everything remaining is an ops page — require a signed-in staff member.
  if (!user) {
    return NextResponse.redirect(new URL("/staff/login", request.url));
  }

  const { data: staffRow } = await supabase
    .from("staff_access")
    .select("id")
    .eq("email", user.email!.toLowerCase())
    .maybeSingle();

  if (!staffRow) {
    return NextResponse.redirect(new URL("/staff/login", request.url));
  }

  return response;
}

export const config = {
  // Run on everything except static assets and Next internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
