// Service worker do NADA Clock: guarda o app para funcionar offline.
// Ao publicar uma nova versão, aumente CACHE_VERSION para os aparelhos baixarem os arquivos novos.
const CACHE_VERSION = "nada-clock-v0.10.0";

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
  "./js/radial.js",
  "./js/awake.js",
  "./js/sysinfo.js",
  "./js/texteditor.js",
  "./js/vendor/qrcode.js",
  "./js/i18n/es.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  // páginas Sobre / About / Acerca (também offline)
  "./sobre/",
  "./about/",
  "./acerca/",
  "./css/about.css",
  "./assets/pt/clock-analog.webp",
  "./assets/pt/clock-digital.webp",
  "./assets/pt/clock-flip.webp",
  "./assets/pt/clock-led.webp",
  "./assets/pt/custom.webp",
  "./assets/pt/pomodoro.webp",
  "./assets/pt/timers.webp",
  "./assets/en/clock-analog.webp",
  "./assets/en/clock-digital.webp",
  "./assets/en/clock-flip.webp",
  "./assets/en/clock-led.webp",
  "./assets/en/custom.webp",
  "./assets/en/pomodoro.webp",
  "./assets/en/timers.webp",
  "./assets/es/clock-analog.webp",
  "./assets/es/clock-digital.webp",
  "./assets/es/clock-flip.webp",
  "./assets/es/clock-led.webp",
  "./assets/es/custom.webp",
  "./assets/es/pomodoro.webp",
  "./assets/es/timers.webp",
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
