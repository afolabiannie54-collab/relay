import { createClient } from '@/lib/supabase/server'
import webpush from 'web-push'
import { NextResponse } from 'next/server'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export async function POST(request) {
  try {
    const { userId, title, body, url } = await request.json()

    if (!userId || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get all push subscriptions for this user
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)

    if (error || !subscriptions?.length) {
      return NextResponse.json({ sent: 0 })
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
    return NextResponse.json({ sent })
  } catch (error) {
    console.error('Push notification error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
