'use server'

import { createClient } from '@/lib/supabase/server'

export async function blockUser(blockedUserId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }
  if (blockedUserId === user.id) return { error: 'Cannot block yourself' }

  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: user.id, blocked_id: blockedUserId })

  if (error) {
    if (error.code === '23505') return { success: true } // already blocked
    return { error: error.message }
  }

  // Hide existing DM conversation
  const { data: participants } = await supabase
    .from('conversation_participants')
    .select('conversation_id, conversations!inner(type)')
    .eq('user_id', user.id)
    .eq('conversations.type', 'dm')

  if (participants?.length) {
    const conversationIds = participants.map(p => p.conversation_id)
    const { data: shared } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', blockedUserId)
      .in('conversation_id', conversationIds)

    if (shared?.length) {
      await supabase.from('conversation_hidden').upsert(
        shared.map(s => ({
          conversation_id: s.conversation_id,
          user_id: user.id,
        })),
        { onConflict: 'conversation_id,user_id' }
      )
    }
  }

  return { success: true }
}

export async function unblockUser(blockedUserId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', blockedUserId)

  if (error) return { error: error.message }

  // Messaging/search/profile/group-add all re-check the blocks table live
  // on every attempt, so those are automatically restored the instant the
  // row above is gone — no separate step needed. conversation_hidden is
  // the one exception: blockUser() wrote it as a one-time side effect, not
  // something derived live, so it has to be explicitly undone here or the
  // conversation stays stranded in Hidden chats forever after unblocking.
  const { data: participants } = await supabase
    .from('conversation_participants')
    .select('conversation_id, conversations!inner(type)')
    .eq('user_id', user.id)
    .eq('conversations.type', 'dm')

  if (participants?.length) {
    const conversationIds = participants.map(p => p.conversation_id)
    const { data: shared } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', blockedUserId)
      .in('conversation_id', conversationIds)

    if (shared?.length) {
      await supabase
        .from('conversation_hidden')
        .delete()
        .eq('user_id', user.id)
        .in('conversation_id', shared.map(s => s.conversation_id))
    }
  }

  return { success: true }
}

export async function getBlockedUsers() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id, users!blocks_blocked_id_fkey(id, username, display_name, avatar_url)')
    .eq('blocker_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { data: data?.map(b => b.users) || [] }
}

export async function isBlocked(otherUserId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { blocked: false }

  const { data } = await supabase
    .from('blocks')
    .select('id')
    .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`)
    .or(`blocker_id.eq.${otherUserId},blocked_id.eq.${otherUserId}`)
    .maybeSingle()

  return { blocked: !!data }
}

// Full set of user ids the caller has any block relationship with, either
// direction — for filtering a list (e.g. recent contacts) in one query
// instead of checking each entry individually. searchUsers() computes
// this same set inline rather than calling this, since it was already
// working before this function existed; kept separate to avoid touching
// code that already works.
export async function getBlockedUserIds() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { data: [] }

  const { data } = await supabase
    .from('blocks')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`)

  const ids = data?.map(b => b.blocker_id === user.id ? b.blocked_id : b.blocker_id) || []
  return { data: ids }
}

export async function deleteAccount() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  try {
    // Anonymize messages
    await supabase
      .from('messages')
      .update({ sender_id: null })
      .eq('sender_id', user.id)

    // Nullify groups.created_by for groups this user created
    // Ownership transfer is handled by the existing DB trigger when we delete from conversation_participants
    await supabase
      .from('groups')
      .update({ created_by: null })
      .eq('created_by', user.id)

    // Delete push subscriptions
    await supabase.from('push_subscriptions').delete().eq('user_id', user.id)

    // Delete profile avatar from storage
    try {
      const extensions = ['jpg', 'jpeg', 'png', 'webp', 'gif']
      for (const ext of extensions) {
        await supabase.storage.from('avatars').remove([`${user.id}/avatar.${ext}`])
      }
    } catch {}

    // Delete public.users row (cascades to most related tables via FK)
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', user.id)

    if (deleteError) return { error: deleteError.message }

    // Delete auth.users record using service role to fully remove credentials
    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    await serviceClient.auth.admin.deleteUser(user.id)

    // Sign out current session
    await supabase.auth.signOut()

    return { success: true }
  } catch (err) {
    return { error: err.message || 'Failed to delete account' }
  }
}
