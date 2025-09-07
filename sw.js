const STATIC_CACHE = 'app-static-v1';
const DYNAMIC_CACHE = 'app-dynamic-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll([
      './',
      'index.html',
      'styles.css',
      'script.js',
      'manifest.webmanifest',
    ])).then(()=> self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => ![STATIC_CACHE, DYNAMIC_CACHE].includes(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === location.origin;
  const isRooster = isSameOrigin && url.pathname.endsWith('/rooster.json');
  const isImage = url.origin.includes('images.start.gg') || req.destination === 'image';

  if (req.mode === 'navigate') {
    event.respondWith(cacheFirst(req));
    return;
  }

  if (isRooster) {
    event.respondWith(networkFirst(req));
    return;
  }

  if (isImage) {
    event.respondWith(cacheFirst(req, true));
    return;
  }

  if (isSameOrigin) {
    event.respondWith(cacheFirst(req));
    return;
  }
});

async function cacheFirst(request, revalidate = false) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    if (revalidate) fetchAndPut(request, cache).catch(()=>{});
    return cached;
  }
  try {
    const res = await fetch(request);
    cache.put(request, res.clone());
    return res;
  } catch (e) {
    return caches.match('index.html');
  }
}

async function networkFirst(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  try {
    const res = await fetch(request);
    cache.put(request, res.clone());
    return res;
  } catch (e) {
    const cached = await cache.match(request);
    return cached || new Response('[]', {headers:{'Content-Type':'application/json'}});
  }
}

async function fetchAndPut(request, cache) {
  try {
    const res = await fetch(request);
    cache.put(request, res.clone());
  } catch {}
}

