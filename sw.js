// Service worker: guarda o app no aparelho para abrir sem internet (academia com sinal ruim).
// Os arquivos do app são servidos do cache e atualizados em segundo plano (a versão nova vale
// na abertura seguinte). Ao adicionar/remover arquivos, atualize SHELL e aumente VERSION.
const VERSION = 'treino-v1';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'icons/icon.svg',
  'icons/icon-192.png',
  'js/main.js',
  'js/state.js',
  'js/db.js',
  'js/sync.js',
  'js/timer.js',
  'js/actions.js',
  'js/ui.js',
  'js/media.js',
  'js/anim.js',
  'js/charts.js',
  'js/seed.js',
  'js/logic/format.js',
  'js/logic/progression.js',
  'js/logic/session.js',
  'js/logic/plates.js',
  'js/logic/youtube.js',
  'js/logic/sync-merge.js',
  'js/logic/backup.js',
  'js/views/home.js',
  'js/views/workout.js',
  'js/views/plans.js',
  'js/views/exercises.js',
  'js/views/history.js',
  'js/views/progress.js',
  'js/views/settings.js',
];
const RUNTIME = 'treino-runtime';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== RUNTIME).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return; // sincronização (POST) sempre vai para a rede
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    // App: responde do cache na hora e atualiza em segundo plano.
    e.respondWith(
      caches.open(VERSION).then(async cache => {
        const hit = await cache.match(req, { ignoreSearch: true });
        const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
        return hit || (await net) || cache.match('index.html');
      }),
    );
    return;
  }
  // Fontes e miniaturas do YouTube: cache em tempo de execução.
  if (/fonts\.(googleapis|gstatic)\.com$|(^|\.)ytimg\.com$/.test(url.hostname)) {
    e.respondWith(
      caches.open(RUNTIME).then(async cache => {
        const hit = await cache.match(req);
        const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => null);
        return hit || (await net) || Response.error();
      }),
    );
  }
});
