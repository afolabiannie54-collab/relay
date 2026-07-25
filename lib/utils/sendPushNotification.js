import webpush from 'web-push'
import { createClient as createServiceClient } from '@supabase/supabase-js'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

// push_subscriptions RLS only allows a user to read their own rows
// (auth.uid() = user_id). Delivering a push means reading the RECIPIENT's
// subscriptions from the SENDER's session, which RLS will always block —
// so this must run with the service role key, bypassing RLS entirely.
function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function sendPushNotification(userId, title, body, url) {
  try {
    const supabase = getServiceClient()

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)

    if (error || !subscriptions?.length) {
      return { sent: 0 }
    }

    const payload = JSON.stringify({
      title,
      body,
      url: url || '/',
      icon: '/icons/logo-light.png',
    })

    const results = await Promise.allSettled(
      subscriptions.map(sub =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        )
      )
    )

    // Remove expired subscriptions
    const expired = results
      .map((result, i) => ({ result, sub: subscriptions[i] }))
      .filter(({ result }) => result.status === 'rejected' &&
        (result.reason?.statusCode === 410 || result.reason?.statusCode === 404))

    if (expired.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expired.map(({ sub }) => sub.endpoint))
    }

    const sent = results.filter(r => r.status === 'fulfilled').length
    return { sent }
  } catch (err) {
    console.error('Failed to send push notification:', err)
    return { error: err.message }
  }
}
