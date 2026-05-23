const SW_VERSION = "fuelplan-pwa-v2";
const APP_SHELL_CACHE = `${SW_VERSION}-app-shell`;
const STATIC_CACHE = `${SW_VERSION}-static`;
const OFFLINE_URL = "/offline";

const APP_SHELL_URLS = [
  "/",
  "/live-session",
  OFFLINE_URL,
  "/manifest.json",
  "/icons/fuelplan-icon-192.png",
  "/icons/fuelplan-icon-512.png",
  "/icons/fuelplan-maskable-512.png",
  "/icons/fuelplan-badge.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => !cacheName.startsWith(SW_VERSION))
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAssetRequest(request)) {
    event.respondWith(cacheFirstStaticAsset(request));
  }
});

self.addEventListener("push", (event) => {
  const payload = readPushPayload(event);
  const title = payload.title || "Fuel now";
  const url = payload.url || "/live-session";

  const notificationOptions = {
    body: payload.body || "Volgende actie volgt straks",
    icon: payload.icon || "/icons/fuelplan-icon-192.png",
    badge: payload.badge || "/icons/fuelplan-badge.svg",
    tag: payload.tag || "fuelplan-live",
    data: { url },
    requireInteraction: Boolean(payload.requireInteraction)
  };

  event.waitUntil(self.registration.showNotification(title, notificationOptions));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(
    event.notification.data?.url || "/live-session",
    self.location.origin
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const targetPath = new URL(targetUrl).pathname;

        for (const client of clientList) {
          const clientUrl = new URL(client.url);

          if (clientUrl.pathname === targetPath && "focus" in client) {
            return client.focus();
          }
        }

        return self.clients.openWindow(targetUrl);
      })
  );
});

function readPushPayload(event) {
  if (!event.data) {
    return {};
  }

  try {
    return event.data.json();
  } catch {
    return { title: "Fuel now", body: event.data.text() };
  }
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(APP_SHELL_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cachedPage = await caches.match(request);
    return cachedPage || caches.match(OFFLINE_URL);
  }
}

async function cacheFirstStaticAsset(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);
  const cache = await caches.open(STATIC_CACHE);
  cache.put(request, response.clone());
  return response;
}

function isStaticAssetRequest(request) {
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return false;
  }

  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json" ||
    /\.(?:css|js|png|jpg|jpeg|svg|webp|gif|ico|woff2?)$/i.test(url.pathname)
  );
}
