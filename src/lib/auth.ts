/**
 * Minimal single-account auth.
 *
 * One password (AUTH_PASSWORD). On login we set a signed HMAC cookie. There is
 * no user table — this is intentionally minimal for a self-hosted single-tenant
 * app. Set AUTH_ENABLED=false to disable login entirely for local-only use.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { config } from "./config";

const COOKIE_NAME = "refx_session";
const SESSION_VALUE = "authenticated";

function sign(value: string): string {
  const mac = createHmac("sha256", config.auth.secret).update(value).digest("hex");
  return `${value}.${mac}`;
}

function verify(signed: string | undefined): boolean {
  if (!signed) return false;
  const idx = signed.lastIndexOf(".");
  if (idx < 0) return false;
  const value = signed.slice(0, idx);
  const mac = signed.slice(idx + 1);
  const expected = createHmac("sha256", config.auth.secret).update(value).digest("hex");
  try {
    const a = Buffer.from(mac, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b) && value === SESSION_VALUE;
  } catch {
    return false;
  }
}

/** Constant-time-ish password check. */
export function checkPassword(input: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(config.auth.password);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function createSession(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, sign(SESSION_VALUE), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** True if the request is authenticated (or auth is disabled). */
export async function isAuthenticated(): Promise<boolean> {
  if (!config.auth.enabled) return true;
  const store = await cookies();
  return verify(store.get(COOKIE_NAME)?.value);
}

export { COOKIE_NAME };

/** Stateless cookie verification for the middleware (no next/headers there). */
export function verifyCookieValue(value: string | undefined): boolean {
  if (!config.auth.enabled) return true;
  return verify(value);
}
