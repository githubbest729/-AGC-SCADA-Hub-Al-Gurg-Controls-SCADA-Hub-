/* =========================================================
   AGC SCADA Hub — service-worker.js
   Caches the app shell so the PWA works fully offline
   on-site with poor or no connectivity.
   ========================================================= */

const CACHE_VERSION = "agc-scada-hub-v1.0.0";
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
  "./icons/icon-512x512.png"
];

// ---- Install: pre-cache the app shell ----
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
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
