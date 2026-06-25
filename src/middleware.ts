import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight auth gate. We can't import next/headers crypto helpers in the
 * edge middleware cheaply, so we only check for the PRESENCE of the session
 * cookie here and do full HMAC verification in server components/actions via
 * isAuthenticated(). This keeps unauthenticated users out of the app shell and
 * redirects them to /login. Set AUTH_ENABLED=false to bypass entirely.
 */
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout"];

export function middleware(req: NextRequest) {
  const authEnabled = process.env.AUTH_ENABLED !== "false";
  if (!authEnabled) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // Allow public paths, static assets, and file serving.
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/files") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("refx_session")?.value;
  if (!cookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
