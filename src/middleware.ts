import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on every request so server components
 * and route handlers see a fresh session. This is the standard Supabase SSR
 * pattern — see https://supabase.com/docs/guides/auth/server-side/nextjs.
 *
 * IMPORTANT: do not put logic between `createServerClient` and `getUser()`;
 * Supabase relies on that call to perform the cookie refresh.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If env isn't configured yet (e.g. first Vercel deploy before secrets
  // were added), pass through silently. The app's client-side auth provider
  // will surface the actual config issue with a useful error; middleware
  // crashing on every request just blanks the whole site with a 500.
  if (!url || !anon) return supabaseResponse;

  try {
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    await supabase.auth.getUser();
  } catch (err) {
    // Network blips, bad keys, Supabase outages — any of these would
    // otherwise crash every request through the matcher with a 500. Log
    // and let the request through; client-side code surfaces auth failure
    // at the page level where it's actionable.
    // eslint-disable-next-line no-console
    console.error("middleware: supabase session refresh failed", err);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Run on everything except Next internals, static assets, and the
    // session-reset endpoint (which must work even when the user is in a
    // wedged auth state — see src/app/api/auth/reset/route.ts).
    "/((?!_next/static|_next/image|favicon.ico|api/auth/reset|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
