// Service worker do NADA Clock: guarda o app para funcionar offline.
// Ao publicar uma nova versão, aumente CACHE_VERSION para os aparelhos baixarem os arquivos novos.
const CACHE_VERSION = "nada-clock-v0.7.1";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/app.js",
  "./js/store.js",
  "./js/i18n.js",
  "./js/i18n/pt-BR.js",
  "./js/i18n/en-US.js",
  "./js/faces.js",
  "./js/settings.js",
  "./js/weather.js",
  "./js/themes.js",
  "./js/tokens.js",
  "./js/components.js",
  "./js/sound.js",
  "./js/timer.js",
  "./js/picker.js",
  "./js/update.js",
  "./js/pomodoro.js",
  "./js/location.js",
  "./js/share.js",
  "./js/free.js",
  "./js/vendor/qrcode.js",
  "./js/i18n/es.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  // cache: "reload" ignora o cache HTTP do navegador e busca os arquivos novos no servidor
  event.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: "reload" })))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Clima e qualquer outro domínio: sempre pela rede (não guardamos em cache).
  if (url.origin !== self.location.origin || event.request.method !== "GET") return;

  // Arquivos do app: cache primeiro, rede como reserva (e atualiza o cache).
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
