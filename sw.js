/* Service worker de visorRAB: cascarón + capas visitadas disponibles sin señal. */
const VERSION = 'rab-v3';
const CASCARON = ['./', 'index.html', 'manifest.webmanifest', 'css/rab-tema.css', 'css/rab-tablero.css', 'css/rab-impresion.css',
  'vendor/maplibre-gl.js', 'vendor/maplibre-gl.css', 'assets/logo-fcv.png', 'assets/icon-192.png',
  'js/rab-util.js', 'js/rab-estado.js', 'js/rab-catalogo.js', 'js/rab-mapa.js', 'js/rab-herramientas.js', 'js/rab-kpis.js',
  'js/rab-graficos.js', 'js/rab-tablas.js', 'js/rab-buscador.js', 'js/rab-ficha.js', 'js/rab-app.js',
  'data/catalogo.json', 'data/zonas.json', 'data/tablas/biodiversidad.json', 'data/tablas/predios.json'];
const MAX_TESELAS = 400;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CASCARON)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== VERSION + '-teselas').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
async function recortar(cache) {
  const ks = await cache.keys();
  if (ks.length > MAX_TESELAS) await Promise.all(ks.slice(0, ks.length - MAX_TESELAS).map((k) => cache.delete(k)));
}
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // Datos y código: se sirve lo guardado y se actualiza en segundo plano.
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const guardado = await c.match(req, { ignoreSearch: true });
      const red = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => guardado);
      return guardado || red;
    }));
  } else if (req.destination === 'image') {
    // Teselas de mapa ya vistas.
    e.respondWith(caches.open(VERSION + '-teselas').then(async (c) => {
      const g = await c.match(req);
      if (g) return g;
      try { const r = await fetch(req); if (r.ok || r.type === 'opaque') { c.put(req, r.clone()); recortar(c); } return r; }
      catch (err) { return new Response('', { status: 504 }); }
    }));
  }
});
