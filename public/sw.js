/* ReFx Business Manager — minimal, conservative service worker.
 *
 * Goals: make the app installable + give it an offline shell, WITHOUT serving
 * stale business data. So:
 *   - immutable Next static assets  -> cache-first
 *   - page navigations              -> network-first, fall back to cached shell
 *   - everything else (API, /api/*) -> straight to network (never cached)
 */
const VERSION = "refx-v1";
const SHELL = `${VERSION}-shell`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API / data routes.
  if (url.pathname.startsWith("/api/")) return;

  // Immutable Next.js build assets: cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(SHELL).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // Page navigations: network-first, offline fallback to cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error())),
    );
    return;
  }
});
