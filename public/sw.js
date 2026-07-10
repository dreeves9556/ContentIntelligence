self.addEventListener('push', function (event) {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon.svg',
    badge: data.badge || '/icon.svg',
    tag: data.tag || 'default',
    requireInteraction: data.requireInteraction ?? false,
    data: { url: data.url || (data.data && data.data.url) || '/', dateOfArrival: Date.now() },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'The Local Post', options)
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clientList) {
        if (clientList.length > 0) {
          const client = clientList[0];
          return client.navigate(url).then(() => client.focus());
        }
        return clients.openWindow(url);
      })
  );
});

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});
