'use server'

import { createClient } from '@/lib/supabase/server'

export async function createGroup(formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const name = formData.get('name')
  const description = formData.get('description')
  const memberIds = formData.getAll('memberIds')

  if (!name?.trim()) return { error: 'Group name is required' }

  const { data, error } = await supabase.rpc('create_group', {
    p_name: name.trim(),
    p_description: description?.trim() || null,
    p_creator_id: user.id,
    p_member_ids: memberIds,
  })

  if (error) return { error: error.message }
  if (data.error) return { error: data.error }

  return { success: true, conversationId: data.conversation_id }
}

export async function getGroupInfo(conversationId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data: group, error } = await supabase
    .from('groups')
    .select('id, name, description, avatar_url, created_by, created_at')
    .eq('conversation_id', conversationId)
    .single()

  if (error) return { error: error.message }

  const { data: members } = await supabase
    .from('conversation_participants')
    .select('user_id, role, joined_at, users(id, username, display_name, avatar_url)')
    .eq('conversation_id', conversationId)
    .order('joined_at', { ascending: true })

  const { data: myRole } = await supabase
    .from('conversation_participants')
    .select('role')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .single()

  return {
    data: {
      ...group,
      members: members?.map(m => ({ ...m, ...m.users, role: m.role })) || [],
      myRole: myRole?.role,
    }
  }
}

export async function updateGroupInfo(conversationId, formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data: participant } = await supabase
    .from('conversation_participants')
    .select('role')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (!participant || !['admin', 'owner'].includes(participant.role)) {
    return { error: 'Only admins and owners can edit group info' }
  }

  const name = formData.get('name')
  const description = formData.get('description')

  if (!name?.trim()) return { error: 'Group name is required' }

  const { data: group } = await supabase
    .from('groups')
    .select('id')
    .eq('conversation_id', conversationId)
    .single()

  const { error } = await supabase
    .from('groups')
    .update({
      name: name.trim(),
      description: description?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', group.id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function uploadGroupAvatar(conversationId, formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data: participant } = await supabase
    .from('conversation_participants')
    .select('role')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (!participant || !['admin', 'owner'].includes(participant.role)) {
    return { error: 'Only admins and owners can change group photo' }
  }

  const file = formData.get('avatar')
  if (!file) return { error: 'No file provided' }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) return { error: 'Only images are allowed' }
  if (file.size > 5 * 1024 * 1024) return { error: 'Image must be under 5MB' }

  const ext = file.name.split('.').pop()
  const path = `groups/${conversationId}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true })

  if (uploadError) return { error: uploadError.message }

  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(path)

  const { data: group } = await supabase
    .from('groups')
    .select('id')
    .eq('conversation_id', conversationId)
    .single()

  await supabase
    .from('groups')
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', group.id)

  return { success: true, url: publicUrl }
}

export async function addMember(conversationId, userId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data: participant } = await supabase
    .from('conversation_participants')
    .select('role')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (!participant || !['admin', 'owner'].includes(participant.role)) {
    return { error: 'Only admins and owners can add members' }
  }

  const { data: memberCount } = await supabase
    .from('conversation_participants')
    .select('id', { count: 'exact' })
    .eq('conversation_id', conversationId)

  if (memberCount?.length >= 500) {
    return { error: 'Group is full (max 500 members)' }
  }

  const { data: block } = await supabase
    .from('blocks')
    .select('id')
    .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`)
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)
    .maybeSingle()

  if (block) return { error: 'Cannot add this user' }

  const { data: existing } = await supabase
    .from('conversation_participants')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) return { error: 'User is already in the group' }

  const { data: senderName } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const { data: newMemberName } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', userId)
    .single()

  await supabase
    .from('conversation_participants')
    .insert({ conversation_id: conversationId, user_id: userId, role: 'member' })

  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: null,
    sender_name_snapshot: 'System',
    content: `${senderName.display_name} added ${newMemberName.display_name}`,
    type: 'system',
  })

  return { success: true }
}

export async function removeMember(conversationId, userId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data: myParticipant } = await supabase
    .from('conversation_participants')
    .select('role')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (!myParticipant || !['admin', 'owner'].includes(myParticipant.role)) {
    return { error: 'Only admins and owners can remove members' }
  }

  const { data: targetParticipant } = await supabase
    .from('conversation_participants')
    .select('role')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .single()

  if (!targetParticipant) return { error: 'User is not in the group' }
  if (targetParticipant.role === 'owner') return { error: 'Cannot remove the group owner' }
  if (targetParticipant.role === 'admin' && myParticipant.role !== 'owner') {
    return { error: 'Only the owner can remove admins' }
  }

  const { data: removedName } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', userId)
    .single()

  await supabase
    .from('conversation_participants')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)

  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: null,
    sender_name_snapshot: 'System',
    content: `${removedName.display_name} was removed from the group`,
    type: 'system',
  })

  return { success: true }
}

export async function leaveGroup(conversationId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', user.id)
    .single()

  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: null,
    sender_name_snapshot: 'System',
    content: `${profile.display_name} left the group`,
    type: 'system',
  })

  await supabase
    .from('conversation_participants')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)

  return { success: true }
}

export async function deleteGroup(conversationId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data: participant } = await supabase
    .from('conversation_participants')
    .select('role')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (!participant || participant.role !== 'owner') {
    return { error: 'Only the owner can delete the group' }
  }

  const { data: group } = await supabase
    .from('groups')
    .select('id')
    .eq('conversation_id', conversationId)
    .single()

  await supabase.from('pinned_messages').delete().eq('conversation_id', conversationId)
  await supabase.from('group_invites').delete().eq('conversation_id', conversationId)
  await supabase.from('conversation_hidden').delete().eq('conversation_id', conversationId)
  await supabase.from('pinned_conversations').delete().eq('conversation_id', conversationId)
  await supabase.from('notifications').delete().eq('reference_id', conversationId)

  const { data: messages } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId)

  if (messages?.length) {
    const messageIds = messages.map(m => m.id)
    await supabase.from('message_reads').delete().in('message_id', messageIds)
    await supabase.from('message_reactions').delete().in('message_id', messageIds)
    await supabase.from('media').delete().in('message_id', messageIds)
  }

  await supabase.from('messages').delete().eq('conversation_id', conversationId)
  await supabase.from('conversation_participants').delete().eq('conversation_id', conversationId)
  await supabase.from('groups').delete().eq('id', group.id)
  await supabase.from('conversations').delete().eq('id', conversationId)

  return { success: true }
}

export async function promoteToAdmin(conversationId, userId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data: participant } = await supabase
    .from('conversation_participants')
    .select('role')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (!participant || participant.role !== 'owner') {
    return { error: 'Only the owner can promote members' }
  }

  await supabase
    .from('conversation_participants')
    .update({ role: 'admin' })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)

  const { data: promotedName } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', userId)
    .single()

  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: null,
    sender_name_snapshot: 'System',
    content: `${promotedName.display_name} is now an admin`,
    type: 'system',
  })

  return { success: true }
}

export async function demoteAdmin(conversationId, userId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data: participant } = await supabase
    .from('conversation_participants')
    .select('role')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (!participant || participant.role !== 'owner') {
    return { error: 'Only the owner can demote admins' }
  }

  await supabase
    .from('conversation_participants')
    .update({ role: 'member' })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)

  return { success: true }
}

export async function getGroupInvites() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('group_invites')
    .select(`
      id,
      status,
      created_at,
      groups(id, name, avatar_url, conversation_id),
      inviter:users!group_invites_inviter_id_fkey(id, username, display_name, avatar_url)
    `)
    .eq('invitee_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { data }
}

export async function acceptGroupInvite(inviteId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data: invite } = await supabase
    .from('group_invites')
    .select('*, groups(conversation_id, name)')
    .eq('id', inviteId)
    .eq('invitee_id', user.id)
    .eq('status', 'pending')
    .single()

  if (!invite) return { error: 'Invite not found' }

  const { data: memberCount } = await supabase
    .from('conversation_participants')
    .select('id', { count: 'exact' })
    .eq('conversation_id', invite.groups.conversation_id)

  if (memberCount?.length >= 500) return { error: 'Group is full' }

  await supabase
    .from('conversation_participants')
    .insert({
      conversation_id: invite.groups.conversation_id,
      user_id: user.id,
      role: 'member',
    })

  await supabase
    .from('group_invites')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', inviteId)

  const { data: profile } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', user.id)
    .single()

  await supabase.from('messages').insert({
    conversation_id: invite.groups.conversation_id,
    sender_id: null,
    sender_name_snapshot: 'System',
    content: `${profile.display_name} joined the group`,
    type: 'system',
  })

  return { success: true, conversationId: invite.groups.conversation_id }
}