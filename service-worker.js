/* =========================================================
   AGC SCADA Hub — service-worker.js
   Enterprise Stale-While-Revalidate PWA Cache Engine
   ========================================================= */

// Incrementing to 2.0.0 forces browsers to wipe the old broken cache
const CACHE_VERSION = "agc-scada-hub-v2.0.0";
const CACHE_NAME = `${CACHE_VERSION}`;

// 1. CORE APP SHELL: Every single file required to boot the app offline.
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192x192.png",
  "./icons/icon-512x512.png",
  
  // Data models
  "./data/boq-catalog.json",
  "./data/sample-project.json",
  "./data/io-tags-sample.json",
  
  // Scripts (CRITICAL: Added missing db.js and io-tags.js)
  "./scripts/db.js",
  "./scripts/export.js",
  "./scripts/pdf-generator.js",
  "./scripts/api.js",
  "./scripts/punchlist.js",
  "./scripts/io-tags.js"
];

// 2. THIRD-PARTY ASSETS: Version strictly matches index.html
const OPTIONAL_SHELL = [
  "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"
];

// ---- Install: Pre-cache the app shell ----
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        await cache.addAll(APP_SHELL);
        
        // Best-effort cache for CDN files using 'no-cors' to avoid opaque response blocking
        await Promise.all(
          OPTIONAL_SHELL.map((url) =>
            cache.add(new Request(url, { mode: 'no-cors' }))
                 .catch((err) => console.warn(`[Service Worker] CDN asset skipped: ${url}`, err))
          )
        );
      })
      .then(() => self.skipWaiting()) // Force the waiting service worker to become the active service worker
  );
});

// ---- Activate: Clean up old caches ----
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

// ---- Fetch: Intercept network requests (Stale-While-Revalidate) ----
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only intercept GET requests. POST requests (like our API sync) bypass the cache.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    // Enterprise Fix: ignoreSearch prevents cache-misses if URLs have tracking/version query params
    caches.match(request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        // Serve instantly from cache, but update the cache in the background
        fetchAndUpdateCache(request);
        return cachedResponse;
      }
      
      // If not in cache, fetch from network
      return fetch(request)
        .then((networkResponse) => {
          fetchAndUpdateCache(request);
          return networkResponse;
        })
        .catch(() => {
          // If offline and file not cached, route SPA navigations back to index.html
          if (request.mode === "navigate") {
            return caches.match("./index.html", { ignoreSearch: true });
          }
          return new Response("Offline and not cached.", {
            status: 503,
            statusText: "Offline"
          });
        });
    })
  );
});

// ---- Background Cache Updater ----
function fetchAndUpdateCache(request) {
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  fetch(request)
    .then((response) => {
      // Enterprise Fix: Accept response.type === "opaque" so Cloudflare CDN scripts are cached properly
      if (response && (response.status === 200 || response.type === "opaque")) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
    })
    .catch(() => {
      // Offline — silently ignore, cached version already served.
    });
}
