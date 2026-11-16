// The offline worker (ADR 0014 item 12). sw-plugin.ts puts `self.PRECACHE` (the page, then every
// file the build wrote) and `self.VERSION` (8 hex digits of a hash of those files' names and contents) before this text.
// No skipWaiting and no clients.claim: a new version waits, and takes over once every tab of the
// game has closed, so a page never mixes the chunks of two builds.

const CACHE = `fair-weather-${self.VERSION}`;
// A host may send `Vary: Origin`, and a module script asks with an Origin header that the install's
// request did not have; each file is one file for any such header, so the match ignores Vary.
const MATCH = { cacheName: CACHE, ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(
        // Past the HTTP cache, so a new build never stores an old page next to its own chunks.
        self.PRECACHE.map((url) => new Request(url, { cache: 'reload' })),
      ),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => n.startsWith('fair-weather-') && n !== CACHE).map((n) => caches.delete(n)),
        ),
      ),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Another origin (the opt-in analytics address) and anything but a GET go to the network untouched.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    request.mode === 'navigate'
      ? // A cached file opened by address (a drawing in a new tab) is that file; any other address of
        // the page, a query too, gets the cached page, and the page reads its own address.
        caches
          .match(request, MATCH)
          .then((hit) => hit ?? caches.match(self.PRECACHE[0], MATCH))
          .then((page) => page ?? fetch(request))
      : caches.match(request, MATCH).then((hit) => hit ?? fetch(request)),
  );
});
