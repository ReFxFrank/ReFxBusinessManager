import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { config } from "@/lib/config";
import { oauthDialogUrl } from "@/lib/social/meta";

export const dynamic = "force-dynamic";

/**
 * Begin the Meta OAuth flow. Gated on `config.meta.configured` — if Meta is not
 * set up we never start the dialog, we just bounce back to the settings page
 * with a clear error so the UI can show setup guidance.
 */
export async function GET(req: NextRequest) {
  if (!config.meta.configured) {
    const url = req.nextUrl.clone();
    url.pathname = "/settings/connections";
    url.search = "";
    url.searchParams.set("error", "not_configured");
    return NextResponse.redirect(url, { status: 303 });
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("meta_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.publicBaseUrl.startsWith("https://"),
    path: "/",
    maxAge: 60 * 10, // 10 minutes
  });

  return NextResponse.redirect(oauthDialogUrl(state), { status: 303 });
}
