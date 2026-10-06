// App shell only: the page, manifest and icons. Data (api.github.com) is never cached.
const CACHE = 'events-tracker-v210';
const BADGE = 'race-hub-badge'; // app icon badge: client messages since the hub was last opened (the page clears it)
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
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== BADGE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
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

// Web Push (owner): a client answered or asked. The page payload is {title, body, url, tag}.
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    // one notification per event: a new answer / question of the same event updates it ("Answered Q2, Q3 — latest text")
    let list = d.kind ? [{ kind: d.kind, n: d.n }] : [];
    if (d.tag) for (const old of await self.registration.getNotifications({ tag: d.tag })) { list = [...(old.data?.list || []), ...list]; old.close(); }
    const ans = list.filter(x => x.kind === 'answered').map(x => 'Q' + x.n), ask = list.filter(x => x.kind === 'asked').length;
    const head = [ans.length ? `Answered ${ans.join(', ')}` : '', ask ? (ask > 1 ? `${ask} new questions` : 'New question') : ''].filter(Boolean).join(' · ');
    const body = list.length > 1 ? `${head} — ${d.text || ''}` : (d.body || '');
    try { const c = await caches.open(BADGE), r = await c.match('n'), n = (r ? +(await r.text()) || 0 : 0) + 1;
      await c.put('n', new Response(String(n))); await self.navigator.setAppBadge?.(n); } catch {}
    const ns = [...new Set(list.map(x => x.n).filter(n => n != null))], url = d.url ? d.url + (ns.length ? '/q' + ns.join(',') : '') : './'; // the hub scrolls to those questions
    await self.registration.showNotification(d.title || 'Race Hub', { body, tag: d.tag, renotify: !!d.tag, timestamp: Date.now(),
      data: { url, list }, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', actions: [{ action: 'open', title: 'Open event' }] });
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.location.href);
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    const w = ws.find(x => new URL(x.url).pathname === url.pathname);   // the hub already open: bring it up on the event
    if (w) return w.focus().then(f => (f || w).navigate ? (f || w).navigate(url.href) : null).catch(() => self.clients.openWindow(url.href));
    return self.clients.openWindow(url.href);
  }));
});
