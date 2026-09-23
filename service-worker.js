/* =========================================================
   AGC SCADA Hub — service-worker.js
   Caches the app shell so the PWA works fully offline
   on-site with poor or no connectivity.
   ========================================================= */

const CACHE_VERSION = "agc-scada-hub-v1.2.0";
const CACHE_NAME = `${CACHE_VERSION}`;

// Files that make up the app shell — cached on install.
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192x192.png",
  "./icons/icon-512x512.png",
  "./data/boq-catalog.json",
  "./data/io-summary-template.json",
  "./data/fat-sat-checklist.json",
  "./data/uae-cost-config.json",
  "./scripts/export.js",
  "./scripts/pdf-generator.js",
  "./scripts/api.js",
  "./scripts/punchlist.js"
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

// ---- Fetch: intercept network requests ----
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // 1. Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 2. Skip non-HTTP requests (like chrome-extension://) to prevent caching errors
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Serve from cache immediately, and refresh the cache in the background.
        fetchAndUpdateCache(request);
        return cachedResponse;
      }
      
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
  const url = new URL(request.url);
  // Double-check here to ensure background cache updates never touch non-http requests
  if (!url.protocol.startsWith('http')) return;

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
