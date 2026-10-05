// App shell only: the page, manifest and icons. Data (api.github.com) is never cached.
const CACHE = 'events-tracker-v155';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './img/active.png', './img/passive.png', './img/decoder.png', './img/loop-box.png', './img/mbox.png', './img/trackbox-active.png', './img/trackbox-passive.png',
  './vendor/leaflet/leaflet.js', './vendor/leaflet/leaflet.css', './vendor/tz-lookup/tz.js'];

// A new version installs and then waits; the page shows "New version available" and asks it to take over.
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
});
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'skipWaiting') self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first, so a new version shows up immediately; cache only as offline fallback.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.status === 200 && r.type === 'basic') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } // only complete replies: never an empty 204 from a blocker
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
    // only a page load falls back to the app page; an image must never get the page instead (it shows as broken)
  );
});
