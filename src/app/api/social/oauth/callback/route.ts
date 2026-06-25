import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { config } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getManagedPages,
  getLinkedInstagram,
} from "@/lib/social/meta";

export const dynamic = "force-dynamic";

function redirectTo(req: NextRequest, params: Record<string, string>) {
  const url = req.nextUrl.clone();
  url.pathname = "/settings/connections";
  url.search = "";
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, { status: 303 });
}

/**
 * OAuth callback: exchange the code, discover the user's Pages + linked IG
 * account, and persist them as SocialConnection rows.
 *
 * Simplification: instead of a Page-picker UI we just use the FIRST managed
 * Page. A multi-Page chooser could be added later by storing all pages and
 * letting the user select one.
 */
export async function GET(req: NextRequest) {
  if (!config.meta.configured) {
    return redirectTo(req, { error: "not_configured" });
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error_description");

  if (oauthError) return redirectTo(req, { error: oauthError });
  if (!code || !state) return redirectTo(req, { error: "Missing code or state" });

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("meta_oauth_state")?.value;
  cookieStore.delete("meta_oauth_state");
  if (!expectedState || expectedState !== state) {
    return redirectTo(req, { error: "Invalid OAuth state" });
  }

  try {
    const shortToken = await exchangeCodeForToken(code);
    const { token: longToken, expiresIn } = await getLongLivedToken(shortToken);
    const pages = await getManagedPages(longToken);

    const page = pages[0];
    if (!page) {
      return redirectTo(req, { error: "No managed Facebook Page found for this account." });
    }

    const tokenExpiry = new Date(Date.now() + expiresIn * 1000);

    await prisma.socialConnection.upsert({
      where: { provider: "facebook" },
      create: {
        provider: "facebook",
        pageId: page.id,
        pageName: page.name,
        accessToken: page.access_token,
        tokenExpiry,
        status: "connected",
      },
      update: {
        pageId: page.id,
        pageName: page.name,
        accessToken: page.access_token,
        tokenExpiry,
        status: "connected",
      },
    });

    // Discover the IG Business/Creator account linked to this Page (if any).
    const ig = await getLinkedInstagram(page.id, page.access_token);
    if (ig) {
      await prisma.socialConnection.upsert({
        where: { provider: "instagram" },
        create: {
          provider: "instagram",
          pageId: page.id,
          igUserId: ig.id,
          igUsername: ig.username,
          accessToken: page.access_token,
          tokenExpiry,
          status: "connected",
        },
        update: {
          pageId: page.id,
          igUserId: ig.id,
          igUsername: ig.username,
          accessToken: page.access_token,
          tokenExpiry,
          status: "connected",
        },
      });
    }

    return redirectTo(req, { connected: "1" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth failed";
    return redirectTo(req, { error: message });
  }
}
