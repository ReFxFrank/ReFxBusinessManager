/**
 * Centralized runtime configuration, read from environment variables.
 * The social feature is fully optional and gated on `meta.configured`.
 */

export const config = {
  auth: {
    enabled: process.env.AUTH_ENABLED !== "false",
    password: process.env.AUTH_PASSWORD ?? "demo1234",
    secret: process.env.AUTH_SECRET ?? "insecure-dev-secret",
  },
  publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  media: {
    maxImageBytes: (Number(process.env.MAX_IMAGE_SIZE_MB) || 15) * 1024 * 1024,
    maxVideoBytes: (Number(process.env.MAX_VIDEO_SIZE_MB) || 200) * 1024 * 1024,
    maxVideoDurationSeconds: Number(process.env.MAX_VIDEO_DURATION_SECONDS) || 60,
  },
  meta: {
    appId: process.env.META_APP_ID ?? "",
    appSecret: process.env.META_APP_SECRET ?? "",
    redirectUri:
      process.env.META_OAUTH_REDIRECT_URI ??
      "http://localhost:3000/api/social/oauth/callback",
    graphVersion: process.env.META_GRAPH_VERSION ?? "v21.0",
    get configured() {
      return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
    },
  },
};

/** True if the public base URL is reachable from the internet (required for IG). */
export function publicUrlIsReachable(): boolean {
  const url = config.publicBaseUrl;
  return !/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(url) && url.startsWith("https://");
}
