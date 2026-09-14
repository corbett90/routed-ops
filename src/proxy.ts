import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Next.js 16 renamed "middleware.ts" to "proxy.ts" (same mechanism, new
// name) — this runs before every matched request. Its job here: keep the
// Supabase Auth session cookie fresh, and gate the customer portal
// (/portal/**) behind a logged-in session. The internal ops pages
// (Vehicles, Routes, Deliver, Proof of Delivery) are untouched by this —
// they use the service-role admin client instead of a user session.
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

  const isPortalRoute = request.nextUrl.pathname.startsWith("/portal");
  const isLoginRoute = request.nextUrl.pathname.startsWith("/portal/login");

  if (isPortalRoute && !isLoginRoute && !user) {
    const loginUrl = new URL("/portal/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/portal/:path*"],
};
