/* Tagwerk Service Worker
   Netzwerk zuerst (damit neue Versionen sofort ankommen), bei fehlendem Netz der Cache.
   So startet die App auch offline, und es muss keine Versionsnummer gepflegt werden. */
const CACHE = 'tagwerk';
const SHELL = [
  './', 'index.html', 'app.css', 'manifest.webmanifest',
  'js/main.js', 'js/ui.js', 'js/state.js', 'js/model.js', 'js/parser.js', 'js/day.js',
  'js/store.js', 'js/filesync.js', 'js/syncrules.js', 'js/pwa.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'
];
const TIMEOUT = 3000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const key = req.mode === 'navigate' ? 'index.html' : url.pathname.replace(/^\//, '') || 'index.html';
  e.respondWith(networkFirst(req, key));
});

async function networkFirst(req, key){
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([
      fetch(req, { cache: 'no-cache' }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT))
    ]);
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(key);
    if (hit) return hit;
    throw err;
  }
}
