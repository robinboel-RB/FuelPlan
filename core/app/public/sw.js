self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const payload = readPushPayload(event);
  const title = payload.title || "Fuel now";
  const url = payload.url || "/live-session";

  const notificationOptions = {
    body: payload.body || "Volgende actie volgt straks",
    icon: payload.icon || "/icons/fuelplan-icon.svg",
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
