const CACHE = "meu-lar-financeiro-shell-v2";
const SCOPE = new URL(self.registration.scope);
const asset = (path) => new URL(path, SCOPE).href;
const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "assets/css/main.css",
  "assets/img/floral-pattern.svg",
  "assets/img/livis-finance.png",
  "assets/img/livis-finance-192.png",
  "assets/img/livis-finance-64.png",
  "assets/img/livis-finance-512.png",
  "assets/img/livis-finance-light.png",
  "assets/img/livis-finance-light-192.png",
  "assets/img/livis-finance-light-64.png",
  "assets/js/theme.js",
  "assets/js/pwa.js",
  "assets/js/store.js",
  "assets/js/exports.js",
  "assets/js/xlsx.js",
  "assets/js/charts.js",
  "assets/js/ui.js",
  "assets/js/views-dashboard.js",
  "assets/js/views-registros.js",
  "assets/js/views-caixa.js",
  "assets/js/views-cartoes.js",
  "assets/js/views-planejamento.js",
  "assets/js/views-extrato.js",
  "assets/js/views-resumo-anual.js",
  "assets/js/views-compras.js",
  "assets/js/views-metas.js",
  "assets/js/views-recorrencias.js",
  "assets/js/views-lembretes.js",
  "assets/js/api.js",
  "assets/js/attachments.js",
  "assets/js/auth.js",
  "assets/js/app.js",
  "backend/src/services/finance.js"
].map(asset);

function isPrivate(url) {
  const path = url.pathname.toLowerCase();
  return path.includes("/api/") || path.endsWith("/api") || path.includes("/backup") || /\/attachments\/(?:content|upload)\//.test(path);
}

function isPublicAsset(url) {
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname) || isPrivate(url)) return false;
  const path = url.pathname.slice(SCOPE.pathname.length);
  return /^(?:assets\/(?:css|js|img)\/|backend\/src\/services\/finance\.js$)/.test(path);
}

async function cacheResponse(request, response) {
  if (!response || !response.ok || response.type === "opaque" || response.headers.has("Set-Cookie") || response.headers.has("Authorization")) return;
  const cache = await caches.open(CACHE);
  await cache.put(request, response.clone());
}

async function networkFirst(request, fallback) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    await cacheResponse(request, response);
    return response;
  } catch (error) {
    return (await caches.match(request)) || (fallback ? caches.match(asset(fallback)) : undefined);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(new Request(url, { cache: "reload" })).catch(() => undefined))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("meu-lar-financeiro-shell-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || isPrivate(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(asset("index.html"), "index.html"));
    return;
  }

  if (isPublicAsset(url) || url.href === asset("manifest.webmanifest")) {
    event.respondWith(networkFirst(request));
  }
});
