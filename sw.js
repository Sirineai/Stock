// Service worker : l'app s'ouvre même si le réseau est lent, et les mises à jour arrivent tout de suite (réseau d'abord).
const V = 'sc-v1';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'config.js', 'icon-192.png', 'manifest.webmanifest'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); return res; })
    .catch(() => caches.match(r).then(m => m || caches.match('index.html'))));
});
