'use client'

import { useEffect, useState } from 'react'
import { subscribeToPush, unsubscribeFromPush } from '@/actions/notifications'

export function usePushNotifications(userId) {
  const [permission, setPermission] = useState('default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!userId) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    setPermission(Notification.permission)

    // Register service worker
    navigator.serviceWorker.register('/sw.js').then(async (registration) => {
      const existing = await registration.pushManager.getSubscription()
      if (existing) setSubscribed(true)
    }).catch(console.error)
  }, [userId])

  const subscribe = async () => {
    if (!('serviceWorker' in navigator)) return { error: 'Not supported' }

    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      setPermission(permission)

      if (permission !== 'granted') {
        setLoading(false)
        return { error: 'Permission denied' }
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        ),
      })

      await subscribeToPush(subscription.toJSON())
      setSubscribed(true)
      setLoading(false)
      return { success: true }
    } catch (err) {
      setLoading(false)
      return { error: err.message }
    }
  }

  const unsubscribe = async () => {
    setLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await unsubscribeFromPush(subscription.endpoint)
        await subscription.unsubscribe()
      }
      setSubscribed(false)
      setLoading(false)
      return { success: true }
    } catch (err) {
      setLoading(false)
      return { error: err.message }
    }
  }

  return { permission, subscribed, loading, subscribe, unsubscribe }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
