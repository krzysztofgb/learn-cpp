/* global BUILD */
// Offline support. Built by the `serviceWorker` Vite plugin, which prepends
// `const BUILD = { precache: [...], lazy: [...] }`: every content-hashed file of this build.
//   precache: the app shell and course chunks, fetched at install
//   lazy:     the compiler and toolchain packs (~160 MB), cached the first time they're used
// Hashed files never change, so they're served cache-first. Navigations and the toolchain
// manifest go to the network first and fall back to the cache when offline.
// No skipWaiting: a new version activates once old tabs close, so they keep the files they loaded.
const CACHE = 'learn-cpp-v1';
const scope = new URL(self.registration.scope);
const absolute = (path) => new URL(path, scope).href;
const hashed = new Set([...BUILD.precache, ...BUILD.lazy].map(absolute));
const INDEX = absolute('index.html');
const MANIFEST = absolute('toolchain/manifest.json');

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([INDEX, MANIFEST, ...BUILD.precache.map(absolute)])));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      for (const request of await cache.keys()) {
        if (!hashed.has(request.url) && request.url !== INDEX && request.url !== MANIFEST) await cache.delete(request);
      }
      for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  // Hashed files are identical for every requester, so ignore Vary (module scripts send Origin, precache didn't).
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, key) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(key, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(key, { ignoreVary: true });
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(scope.origin)) return;
  const url = request.url.split('#')[0];
  if (request.mode === 'navigate') event.respondWith(networkFirst(request, INDEX));
  else if (url === MANIFEST) event.respondWith(networkFirst(request, MANIFEST));
  else if (hashed.has(url)) event.respondWith(cacheFirst(request));
});
