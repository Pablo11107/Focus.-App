// sw.js — Service Worker básico para FOCUS (PWA)
//
// Objetivo: cachear el "app shell" (HTML/JS/CSS/iconos propios) para que la
// app cargue rápido y algo funcione offline, sin tocar nunca las peticiones
// a Firebase/Firestore/Google Fonts, que deben seguir yendo siempre a la red
// en tiempo real (login, guardado de hábitos, onSnapshot, etc).
//
// Sube este número cada vez que cambies archivos estáticos para forzar
// que los usuarios reciban la versión nueva.
const CACHE_VERSION = "focus-v3";

const APP_SHELL = [
  "index.html",
  "login.html",
  "verify-email.html",
  "communities.html",
  "memories.html",
  "legacy.html",
  "socialclub.html",
  "books.html",
  "dock-nav.js",
  "firebase-init.js",
  "splash.js",
  "true-focus.js",
  "weekly-wrap.js",
  "study-library.js",
  "you-vs-you.js",
  "you-vs-you.css",
  "manifest.json",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Extensiones que tratamos como "estáticas" -> cache-first
const STATIC_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico"];

function isStaticAsset(pathname) {
  return STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptamos peticiones GET de nuestro propio origen.
  // Todo lo demás (Firebase Auth, Firestore, Google Fonts, el SDK de
  // Firebase servido desde gstatic.com, etc.) pasa de largo tal cual,
  // sin que el Service Worker lo toque: así el tiempo real no se rompe.
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (isStaticAsset(url.pathname)) {
    // Cache-first: rápido y suficiente para imágenes/iconos, que apenas cambian.
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        });
      })
    );
    return;
  }

  // Para HTML/JS/CSS: network-first, con fallback a cache si no hay red.
  // Así los usuarios siempre reciben tu última versión cuando hay conexión,
  // y la app sigue "funcionando" (con la última versión guardada) sin ella.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
