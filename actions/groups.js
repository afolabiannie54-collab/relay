'use server'

import { createClient } from '@/lib/supabase/server'
import { sanitizeText } from '@/lib/utils/sanitize'
import { sendPushNotification } from '@/lib/utils/sendPushNotification'

export async function createGroup(formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const name = sanitizeText(formData.get('name'), 50)
  const description = sanitizeText(formData.get('description'), 200)
  const memberIds = formData.getAll('memberIds')

  if (!name) return { error: 'Group name is required' }

  const { data, error } = await supabase.rpc('create_group', {
    p_name: name,
    p_description: description || null,
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
    .select('user_id, role, joined_at, last_delivered_at, users(id, username, display_name, avatar_url)')
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

  const name = sanitizeText(formData.get('name'), 50)
  const description = sanitizeText(formData.get('description'), 200)

  if (!name) return { error: 'Group name is required' }

  const { data: group } = await supabase
    .from('groups')
    .select('id')
    .eq('conversation_id', conversationId)
    .single()

  const { error } = await supabase
    .from('groups')
    .update({
      name,
      description: description || null,
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

  // Only add directly if the two of you are actual contacts (an accepted
  // message request exists between you, either direction) — otherwise
  // this needs to go through a group invite the invitee accepts, same as
  // any other first-contact-through-a-stranger case in the app. Checked
  // against message_requests directly rather than "does a DM conversation
  // exist", since a conversation row is created the moment a request is
  // SENT (still pending, unaccepted) — that shouldn't count as contact.
  const { data: acceptedRequest } = await supabase
    .from('message_requests')
    .select('id')
    .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
    .eq('status', 'accepted')
    .maybeSingle()

  if (!acceptedRequest) {
    const { data: group } = await supabase
      .from('groups')
      .select('id, name')
      .eq('conversation_id', conversationId)
      .single()

    if (!group) return { error: 'Group not found' }

    const { data: existingInvite } = await supabase
      .from('group_invites')
      .select('id')
      .eq('group_id', group.id)
      .eq('invitee_id', userId)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingInvite) return { error: 'An invite is already pending for this user' }

    const { error: inviteError } = await supabase
      .from('group_invites')
      .insert({ group_id: group.id, inviter_id: user.id, invitee_id: userId, status: 'pending' })

    if (inviteError) return { error: inviteError.message }

    sendPushNotification(
      userId,
      'Group invite',
      `${senderName.display_name} invited you to join "${group.name}"`,
      '/requests',
      null,
      'group_invite'
    )

    return { success: true, invited: true }
  }

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

  // conversation_participants' only DELETE policy is "auth.uid() = user_id"
  // — the admin's own session can't remove someone else's row via RLS, so
  // this silently deleted zero rows while still reporting success (same
  // failure mode deleteGroup() below already works around). The
  // permission checks above already ran under the normal RLS-scoped
  // client; only the delete itself needs the service role.
  const { createClient: createServiceClient } = await import('@supabase/supabase-js')
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  await serviceClient
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

  const { data: participant } = await supabase
    .from('conversation_participants')
    .select('role')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (participant?.role === 'owner') {
    return { error: 'Transfer ownership to another member before leaving this group.' }
  }

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

  // Ownership is verified with the normal, RLS-scoped client — only
  // once that's confirmed do we escalate to the service-role client
  // below, and only for the deletion itself.
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

  // Notify every other participant before anything is deleted — a
  // security definer function, so it inserts notifications for them
  // regardless of the caller's own RLS scope. ChatList.js's realtime
  // subscription already listens for these and refreshes the list.
  await supabase.rpc('notify_group_members_of_deletion', {
    p_conversation_id: conversationId,
    p_deleting_user_id: user.id,
  })

  // conversation_participants (and notifications addressed to other
  // users) are normally only deletable by their own row's user via RLS
  // — the owner's session can't remove another member's participant
  // row. Supabase doesn't error when a delete's RLS policy silently
  // narrows it to zero affected rows, so the previous version of this
  // function appeared to succeed while actually leaving every other
  // participant's row in place, and the group kept showing up for them.
  // The service-role client bypasses RLS so the delete actually reaches
  // every row it's supposed to.
  const { createClient: createServiceClient } = await import('@supabase/supabase-js')
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  await serviceClient.from('pinned_messages').delete().eq('conversation_id', conversationId)
  await serviceClient.from('group_invites').delete().eq('conversation_id', conversationId)
  await serviceClient.from('conversation_hidden').delete().eq('conversation_id', conversationId)
  await serviceClient.from('pinned_conversations').delete().eq('conversation_id', conversationId)
  // Excludes 'group_removed' — notify_group_members_of_deletion() just
  // inserted those above, and they're the only reliable way the other
  // participants find out this group is gone (their own DELETE on
  // conversation_participants can't be delivered via Realtime: the RLS
  // check that authorizes it re-queries conversation_participants, which
  // this same function has by now emptied). Deleting them here would
  // erase that signal before it's had a chance to reach anyone.
  await serviceClient.from('notifications').delete().eq('reference_id', conversationId).neq('type', 'group_removed')

  const { data: messages } = await serviceClient
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId)

  if (messages?.length) {
    const messageIds = messages.map(m => m.id)
    await serviceClient.from('message_reads').delete().in('message_id', messageIds)
    await serviceClient.from('message_reactions').delete().in('message_id', messageIds)
    await serviceClient.from('media').delete().in('message_id', messageIds)
  }

  // The four deletes that actually matter for "does anyone still see
  // this group" — explicit and in this order, not left to cascades.
  await serviceClient.from('messages').delete().eq('conversation_id', conversationId)
  await serviceClient.from('conversation_participants').delete().eq('conversation_id', conversationId)
  if (group?.id) await serviceClient.from('groups').delete().eq('id', group.id)
  await serviceClient.from('conversations').delete().eq('id', conversationId)

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

export async function transferOwnership(conversationId, newOwnerId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }
  if (newOwnerId === user.id) return { error: 'You are already the owner' }

  const { data: participant } = await supabase
    .from('conversation_participants')
    .select('role')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (!participant || participant.role !== 'owner') {
    return { error: 'Only the owner can transfer ownership' }
  }

  const { data: newOwnerParticipant } = await supabase
    .from('conversation_participants')
    .select('role')
    .eq('conversation_id', conversationId)
    .eq('user_id', newOwnerId)
    .single()

  if (!newOwnerParticipant) return { error: 'User is not in the group' }

  const { data: newOwnerName } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', newOwnerId)
    .single()

  // Updating another user's role — the service-role client bypasses RLS
  // for this, same pattern as removeMember()/deleteGroup() above.
  const { createClient: createServiceClient } = await import('@supabase/supabase-js')
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  await serviceClient
    .from('conversation_participants')
    .update({ role: 'owner' })
    .eq('conversation_id', conversationId)
    .eq('user_id', newOwnerId)

  await serviceClient
    .from('conversation_participants')
    .update({ role: 'admin' })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)

  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: null,
    sender_name_snapshot: 'System',
    content: `${newOwnerName.display_name} is now the group owner`,
    type: 'system',
  })

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

export async function declineGroupInvite(inviteId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('group_invites')
    .update({ status: 'declined', updated_at: new Date().toISOString() })
    .eq('id', inviteId)
    .eq('invitee_id', user.id)
    .eq('status', 'pending')

  if (error) return { error: error.message }
  return { success: true }
}