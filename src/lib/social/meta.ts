/**
 * Meta Graph API helpers (OAuth + token exchange + Page/IG discovery).
 *
 * Endpoints/scopes follow the current Graph API + Instagram Content Publishing
 * API (verified against Meta docs at build time; pin the version via
 * META_GRAPH_VERSION). App Review is required before this works beyond
 * developer/test users — see the README.
 */

import { config } from "../config";
import { SocialError } from "./types";

const GRAPH = () => `https://graph.facebook.com/${config.meta.graphVersion}`;

/** Scopes required for Page + IG Business publishing. */
export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
].join(",");

export function oauthDialogUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.meta.appId,
    redirect_uri: config.meta.redirectUri,
    state,
    scope: META_SCOPES,
    response_type: "code",
  });
  return `https://www.facebook.com/${config.meta.graphVersion}/dialog/oauth?${params}`;
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = `${GRAPH()}/${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new SocialError(json.error?.message ?? `Graph GET ${path} failed`, json.error?.code);
  }
  return json as T;
}

async function graphPost<T>(path: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`${GRAPH()}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new SocialError(json.error?.message ?? `Graph POST ${path} failed`, json.error?.code);
  }
  return json as T;
}

/** Exchange an OAuth code for a short-lived user token. */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const json = await graphGet<{ access_token: string }>("oauth/access_token", {
    client_id: config.meta.appId,
    client_secret: config.meta.appSecret,
    redirect_uri: config.meta.redirectUri,
    code,
  });
  return json.access_token;
}

/** Upgrade a short-lived user token to a long-lived one (~60 days). */
export async function getLongLivedToken(shortToken: string): Promise<{ token: string; expiresIn: number }> {
  const json = await graphGet<{ access_token: string; expires_in?: number }>("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: config.meta.appId,
    client_secret: config.meta.appSecret,
    fb_exchange_token: shortToken,
  });
  return { token: json.access_token, expiresIn: json.expires_in ?? 60 * 24 * 3600 };
}

export interface MetaPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string };
}

/** List Pages the user manages, with their Page tokens + linked IG account. */
export async function getManagedPages(userToken: string): Promise<MetaPage[]> {
  const json = await graphGet<{ data: MetaPage[] }>("me/accounts", {
    access_token: userToken,
    fields: "id,name,access_token,instagram_business_account{id,username}",
  });
  return json.data ?? [];
}

/** Resolve the IG Business/Creator account linked to a Page. */
export async function getLinkedInstagram(
  pageId: string,
  pageToken: string,
): Promise<{ id: string; username: string } | null> {
  const json = await graphGet<{ instagram_business_account?: { id: string }; }>(pageId, {
    access_token: pageToken,
    fields: "instagram_business_account",
  });
  const igId = json.instagram_business_account?.id;
  if (!igId) return null;
  const ig = await graphGet<{ username: string }>(igId, {
    access_token: pageToken,
    fields: "username",
  });
  return { id: igId, username: ig.username };
}

export { graphGet, graphPost, GRAPH };
