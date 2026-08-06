'use server'

import { createClient } from '@/lib/supabase/server'

export async function getNotifications(page = 0) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const limit = 30
  const offset = page * limit

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return { error: error.message }
  return { data }
}

export async function getUnreadCount() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { count: 0 }

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('read', false)

  if (error) return { count: 0 }
  return { count: count || 0 }
}

export async function markNotificationRead(notificationId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  return { success: true }
}

export async function markAllNotificationsRead() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false)

  if (error) return { error: error.message }

  return { success: true }
}

export async function subscribeToPush(subscription) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { endpoint, keys } = subscription

  // Worth checking especially here: a swallowed failure meant "Enable on
  // this device" reported success while no subscription row existed, so
  // the toggle looked on and no push ever arrived.
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    }, { onConflict: 'endpoint' })

  if (error) return { error: error.message }

  return { success: true }
}

export async function unsubscribeFromPush(endpoint) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  if (error) return { error: error.message }

  return { success: true }
}

export async function getRequestsCount() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { count: 0 }

  const [{ count: messageRequestCount }, { count: groupInviteCount }] = await Promise.all([
    supabase
      .from('message_requests')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('status', 'pending'),
    supabase
      .from('group_invites')
      .select('*', { count: 'exact', head: true })
      .eq('invitee_id', user.id)
      .eq('status', 'pending'),
  ])

  return { count: (messageRequestCount || 0) + (groupInviteCount || 0) }
}