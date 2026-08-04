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

// Maps a notification `type` to the privacy_settings column that gates it.
// Only the three categories actually exposed in
// components/settings/NotificationSettingsSheet.js are checked here —
// anything else (message requests, request-accepted) has no corresponding
// column and is never gated.
const NOTIFICATION_SETTING_COLUMN = {
  direct_message: 'message_notifications',
  group_message: 'group_notifications',
  mention: 'mention_notifications',
}

export async function sendPushNotification(userId, title, body, url, conversationId, type) {
  try {
    const supabase = getServiceClient()

    if (conversationId) {
      const { data: mute } = await supabase
        .from('conversation_mutes')
        .select('muted_until')
        .eq('user_id', userId)
        .eq('conversation_id', conversationId)
        .maybeSingle()

      if (mute && (!mute.muted_until || new Date(mute.muted_until) > new Date())) {
        return { sent: 0, muted: true }
      }

      // Like WhatsApp: no push for a conversation the recipient already has
      // open and visible — they're already looking at it, a system
      // notification would just be redundant. viewing_until is a
      // client-refreshed TTL (see setViewingConversation), not a plain
      // flag, so this can't get stuck suppressing push forever if their
      // tab crashes instead of navigating away cleanly.
      const { data: participant } = await supabase
        .from('conversation_participants')
        .select('viewing_until')
        .eq('user_id', userId)
        .eq('conversation_id', conversationId)
        .maybeSingle()

      if (participant?.viewing_until && new Date(participant.viewing_until) > new Date()) {
        return { sent: 0, viewing: true }
      }
    }

    const settingColumn = NOTIFICATION_SETTING_COLUMN[type]
    if (settingColumn) {
      const { data: settings } = await supabase
        .from('privacy_settings')
        .select(settingColumn)
        .eq('user_id', userId)
        .maybeSingle()

      if (settings && settings[settingColumn] === false) {
        return { sent: 0, disabled: true }
      }
    }

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
