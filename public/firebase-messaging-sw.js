/* Firebase Cloud Messaging Service Worker - DJOUMA FOOT LIVE */
self.addEventListener('push', function (event) {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { notification: { title: 'DJOUMA FOOT LIVE', body: event.data ? event.data.text() : '' } };
  }
  const notif = payload.notification || {};
  const title = notif.title || 'DJOUMA FOOT LIVE';
  const options = {
    body: notif.body || 'Nouvelle alerte match en direct',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: payload.data || {},
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('/'));
});
