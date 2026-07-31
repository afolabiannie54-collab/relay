self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()

  event.waitUntil(
    (async () => {
      const url = data.url || '/'

      // Suppress the notification if a focused tab is already looking at
      // this exact conversation — sendPushNotification() runs server-side
      // and has no way to know what the client has open, but the client
      // itself does via clients.matchAll(). WindowClient.focused is a
      // real, synchronous property here, no round-trip to the page needed.
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const isViewingIt = clientList.some(client => client.focused && client.url.includes(url))
      if (isViewingIt) return

      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon || '/icons/logo-light.png',
        badge: '/icons/logo-light.png',
        data: { url },
        vibrate: [200, 100, 200],
      })
    })()
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          client.navigate(event.notification.data.url)
          return
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url)
      }
    })
  )
})
