import { NextResponse, type NextRequest } from "next/server";

/**
 * Force-clears every Supabase auth cookie and redirects to /login.
 *
 * Useful when a user lands in a wedged state (stale JWT for a deleted user,
 * cookie format change after a Supabase SDK upgrade, etc.) and the normal
 * "sign out" UI isn't reachable. Hit this URL directly:
 *   http://localhost:3000/api/auth/reset
 *
 * Server-side cookie deletion isn't blocked by browser extensions or strict
 * privacy modes the way client-side `localStorage.clear()` can be.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  const response = NextResponse.redirect(url);

  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      response.cookies.delete(cookie.name);
    }
  }
  return response;
}
