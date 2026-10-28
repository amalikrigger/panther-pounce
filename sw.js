// Offline support (a "service worker"). After one visit to the hosted game
// with internet, the browser keeps a copy of every file, so the game still
// loads and plays with no Wi-Fi. Event Wi-Fi is unreliable!
//
// How it works: every file the game loads is saved in a cache. Next time, the
// saved copy is used right away, and a fresh copy is fetched in the
// background (if there's internet) for the visit after that.
//
// It only runs on the real website (https). On a local test server it's
// switched off, so your edits always show up when you refresh. (See
// setupOffline() in src/main.js.)
//
// If you change how this file works, bump the version so old caches are
// cleared.

const CACHE = 'panther-pounce-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['./', 'index.html'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('panther-pounce-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// The page sends the list of files it already loaded (before this worker
// was running), so those get saved too.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'cache-urls') return;
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.all(event.data.urls.map((url) => cache.add(url).catch(() => {})))),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      const fromNetwork = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => null);

      if (cached) {
        // Use the saved copy now; refresh it in the background.
        event.waitUntil(fromNetwork);
        return cached;
      }
      const response = await fromNetwork;
      if (response) return response;
      // Offline and never saved: for the page itself, fall back to the saved index.html.
      if (request.mode === 'navigate') return (await cache.match('index.html')) ?? Response.error();
      return Response.error();
    }),
  );
});
