'use server'

import { createClient } from '@/lib/supabase/server'

export async function muteConversation(conversationId, mutedUntil) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('conversation_mutes')
    .upsert({
      user_id: user.id,
      conversation_id: conversationId,
      muted_until: mutedUntil ? new Date(mutedUntil).toISOString() : null,
    }, { onConflict: 'user_id,conversation_id' })

  if (error) return { error: error.message }
  return { success: true }
}

export async function unmuteConversation(conversationId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('conversation_mutes')
    .delete()
    .eq('user_id', user.id)
    .eq('conversation_id', conversationId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function getMuteStatus(conversationId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { muted: false, mutedUntil: null }

  const { data } = await supabase
    .from('conversation_mutes')
    .select('muted_until')
    .eq('user_id', user.id)
    .eq('conversation_id', conversationId)
    .maybeSingle()

  if (!data) return { muted: false, mutedUntil: null }

  if (data.muted_until && new Date(data.muted_until) <= new Date()) {
    return { muted: false, mutedUntil: null }
  }

  return { muted: true, mutedUntil: data.muted_until }
}

// Permanently removes a conversation from this user's list — unlike
// hideConversation(), a deleted conversation never resurfaces even when
// new messages arrive (get_user_conversations excludes anything in
// conversation_deleted unconditionally). The other participant's copy
// of the conversation is untouched.
export async function deleteConversationForUser(conversationId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('conversation_deleted')
    .upsert({
      conversation_id: conversationId,
      user_id: user.id,
      deleted_at: new Date().toISOString(),
    }, { onConflict: 'conversation_id,user_id' })

  if (error) return { error: error.message }
  return { success: true }
}

export async function getMutedConversationIds() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { data: [] }

  const { data, error } = await supabase
    .from('conversation_mutes')
    .select('conversation_id, muted_until')
    .eq('user_id', user.id)

  if (error) return { data: [] }

  const now = new Date()
  const activeIds = (data || [])
    .filter(m => !m.muted_until || new Date(m.muted_until) > now)
    .map(m => m.conversation_id)

  return { data: activeIds }
}
