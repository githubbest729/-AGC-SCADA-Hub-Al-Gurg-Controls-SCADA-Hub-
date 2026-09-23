/* =========================================================
   AGC SCADA Hub — service-worker.js
   Caches the app shell so the PWA works fully offline
   on-site with poor or no connectivity.
   ========================================================= */

const CACHE_VERSION = "agc-scada-hub-v1.1.0";
const CACHE_NAME = `${CACHE_VERSION}`;

// Files that make up the app shell — cached on install.
// Paths are relative so this works whether the app is hosted
// at the domain root or in a GitHub Pages subpath (/repo-name/).
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192x192.png",
  "./icons/icon-512x512.png",
  "./data/boq-catalog.json",
  "./scripts/export.js",
  "./scripts/pdf-generator.js",
  "./scripts/api.js"
];

// Third-party assets cached opportunistically (best-effort — install
// should not fail if the CDN is briefly unreachable at install time).
const OPTIONAL_SHELL = [
  "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.8.0/html2pdf.bundle.min.js"
];

// ---- Install: pre-cache the app shell ----
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        await cache.addAll(APP_SHELL);
        // Best-effort: don't let a flaky CDN block install of the core app shell
        await Promise.all(
          OPTIONAL_SHELL.map((url) =>
            cache.add(url).catch((err) => console.warn("Optional asset not cached:", url, err))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ---- Activate: clean up old caches ----
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ---- Fetch: cache-first for app shell, network-first fallback for everything else ----
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Serve from cache immediately (fast + offline-safe),
        // and refresh the cache in the background when online.
        fetchAndUpdateCache(request);
        return cachedResponse;
      }
      // Not cached yet — try the network, fall back to cached index.html
      // for navigation requests so the app still loads offline.
      return fetch(request)
        .then((networkResponse) => {
          fetchAndUpdateCache(request);
          return networkResponse;
        })
        .catch(() => {
          if (request.mode === "navigate") {
            return caches.match("./index.html");
          }
          return new Response("Offline and not cached.", {
            status: 503,
            statusText: "Offline"
          });
        });
    })
  );
});

function fetchAndUpdateCache(request) {
  fetch(request)
    .then((response) => {
      if (response && response.status === 200 && response.type === "basic") {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
    })
    .catch(() => {
      // Offline — silently ignore, cached version already served.
    });
}
