// SERVICE WORKER: lets the app open and show the latest saved data without a connection.

// Raise it when the app changes in depth: browsers drop the old cached files on their own
const VERSION = 'v2';
const APP_CACHE = `ats-app-${VERSION}`;
// Same name as API_CACHE in src/app/core/workers/api-cache.ts (the app clears it on logout)
const API_CACHE = `ats-api-${VERSION}`;

// Backend paths that can be read offline (GET only)
const API_PATHS = ['/public', '/jobs', '/candidates', '/applications', '/stats', '/me', '/ai/status'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(['/', '/index.html', '/favicon.svg']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== APP_CACHE && n !== API_CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return; // writes always go straight to the network

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin) {
    event.respondWith(request.mode === 'navigate' ? pageNetworkFirst(request) : staticFile(request));
  } else if (API_PATHS.some((path) => url.pathname === path || url.pathname.startsWith(path + '/'))) {
    event.respondWith(apiNetworkFirst(request));
  }
});

// Pages: network first (to get new versions) and, if it fails, the saved copy
async function pageNetworkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(APP_CACHE);
    cache.put('/index.html', response.clone());
    return response;
  } catch {
    return (await caches.match('/index.html')) || (await caches.match('/')) || offlineResponse();
  }
}

// App files (JS, CSS, images): served from the copy and refreshed in the background
async function staticFile(request) {
  const cache = await caches.open(APP_CACHE);
  const saved = await cache.match(request);
  const fromNetwork = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return saved || (await fromNetwork) || offlineResponse();
}

// Backend data: network first; offline, the last saved answer marked with X-From-Cache
async function apiNetworkFirst(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const saved = await cache.match(request);
    if (!saved) return offlineResponse();
    const headers = new Headers(saved.headers);
    headers.set('X-From-Cache', '1');
    return new Response(saved.body, { status: saved.status, statusText: saved.statusText, headers });
  }
}

function offlineResponse() {
  return new Response(JSON.stringify({ detail: 'Sin conexión y sin datos guardados todavía' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}
