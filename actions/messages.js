'use server'

import { sendPushNotification } from '@/lib/utils/sendPushNotification'
import { createClient } from '@/lib/supabase/server'
import { sanitizeText } from '@/lib/utils/sanitize'

// sendMessageRequest() (new DMs) already goes through create_message_request,
// a SECURITY DEFINER function that checks blocks itself — but sendMessage()
// and uploadMedia() (messages in an ALREADY-existing conversation) never
// checked at all, so a block did nothing to stop either side from
// continuing to message in a conversation that predated it. Only restricts
// direct messages, same as WhatsApp — a block between two people doesn't
// affect messages either of them sends in a shared group. Returns the
// conversation's type alongside the block result so callers that also need
// the type (sendMessage, for its push-notification category) don't have to
// fetch it twice.
async function checkDmBlock(supabase, conversationId, senderId) {
  const { data: conversationRow } = await supabase
    .from('conversations')
    .select('type')
    .eq('id', conversationId)
    .single()

  if (conversationRow?.type !== 'dm') {
    return { blocked: false, type: conversationRow?.type }
  }

  const { data: otherParticipant } = await supabase
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .neq('user_id', senderId)
    .maybeSingle()

  if (!otherParticipant) return { blocked: false, type: conversationRow.type }

  const { data: block } = await supabase
    .from('blocks')
    .select('id')
    .or(`blocker_id.eq.${senderId},blocked_id.eq.${senderId}`)
    .or(`blocker_id.eq.${otherParticipant.user_id},blocked_id.eq.${otherParticipant.user_id}`)
    .maybeSingle()

  return { blocked: !!block, type: conversationRow.type }
}

// The message-request flow's entire premise — one intro message, then
// silence until the receiver accepts — was only ever enforced by the UI
// happening to not offer a compose box, and by conversation_hidden
// keeping it out of both parties' main list. Neither actually stops
// sendMessage/uploadMedia from being called directly against the
// conversation once you're in it (which the sender always is, right
// after sending the request — hiding only affects list membership, not
// the page they get redirected straight into). This is the real gate:
// block any further message while a request on this conversation is
// still pending, regardless of how the conversation view was reached.
async function checkPendingRequest(supabase, conversationId) {
  const { data } = await supabase
    .from('message_requests')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('status', 'pending')
    .maybeSingle()

  return !!data
}

export async function sendMessageRequest(receiverId, content) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const cleanContent = sanitizeText(content, 2000)
  if (!cleanContent) return { error: 'Message cannot be empty' }

  const { data, error } = await supabase.rpc('create_message_request', {
    p_receiver_id: receiverId,
    p_content: cleanContent,
  })

  if (error) return { error: error.message }
  if (data.error) return { error: data.error, conversationId: data.conversationId }

  // Notify receiver of message request
  const { data: senderProfile } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', user.id)
    .single()

  if (senderProfile) {
    sendPushNotification(
      receiverId,
      'New message request',
      `${senderProfile.display_name} wants to chat with you`,
      '/requests',
      data.conversationId
    )
  }

  return { success: true, conversationId: data.conversationId }
}

export async function acceptMessageRequest(requestId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data: request, error } = await supabase
    .from('message_requests')
    .select('*')
    .eq('id', requestId)
    .eq('receiver_id', user.id)
    .eq('status', 'pending')
    .single()

  if (error || !request) return { error: 'Request not found' }

  // Update request status
  await supabase
    .from('message_requests')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', requestId)

  // Notify the original sender that their request was accepted
  const { data: accepterProfile } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', user.id)
    .single()

  await supabase.from('notifications').insert({
    user_id: request.sender_id,
    type: 'message_request',
    reference_id: request.conversation_id,
    title: `${accepterProfile.display_name} accepted your message request`,
    body: 'You can now chat freely.',
  })

  sendPushNotification(
    request.sender_id,
    `${accepterProfile.display_name} accepted your message request`,
    'You can now chat freely.',
    `/chat/${request.conversation_id}`,
    request.conversation_id
  )

  // Remove from hidden conversations for BOTH sides — create_message_request
  // hides it for the sender too (not just the receiver calling this), and
  // nothing else ever un-hides the sender's copy once accepted. Scoped to
  // just this conversation_id, not just `user.id`, so acceptance clears
  // the automatic pending-hide for whoever it applied to.
  await supabase
    .from('conversation_hidden')
    .delete()
    .eq('conversation_id', request.conversation_id)
    .in('user_id', [user.id, request.sender_id])

  return { success: true, conversationId: request.conversation_id }
}

export async function cancelMessageRequest(requestId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('message_requests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('sender_id', user.id)
    .eq('status', 'pending')

  if (error) return { error: error.message }
  return { success: true }
}

export async function getMessageRequests() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('message_requests')
    .select(`
      id,
      status,
      created_at,
      sender:users!message_requests_sender_id_fkey(id, username, display_name, avatar_url),
      message:messages!message_requests_message_id_fkey(content)
    `)
    .eq('receiver_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { data }
}

export async function getSentMessageRequests() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('message_requests')
    .select(`
      id,
      status,
      created_at,
      receiver:users!message_requests_receiver_id_fkey(id, username, display_name, avatar_url),
      message:messages!message_requests_message_id_fkey(content)
    `)
    .eq('sender_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { data }
}

export async function getConversations() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase.rpc('get_user_conversations', {
    p_user_id: user.id,
  })

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function getUnreadChatsCount() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { count: 0 }

  const { data, error } = await supabase.rpc('get_user_conversations', {
    p_user_id: user.id,
  })

  if (error || !data) return { count: 0 }

  const count = data.filter(c => c.unread_count > 0).length
  return { count }
}

export async function getConversation(conversationId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  // These four reads don't depend on one another — fire them together
  // instead of paying for four sequential round-trips.
  const [participantResult, conversationResult, participantsResult, pendingRequestResult] = await Promise.all([
    supabase
      .from('conversation_participants')
      .select('role')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('conversations')
      .select('type')
      .eq('id', conversationId)
      .single(),
    supabase
      .from('conversation_participants')
      .select(`
        user_id,
        role,
        users!inner(id, username, display_name, avatar_url, last_seen, privacy_settings(show_online_status, show_last_seen))
      `)
      .eq('conversation_id', conversationId)
      .neq('user_id', user.id),
    // Lets the conversation page tell "waiting for them to accept" apart
    // from a normal, already-open conversation — sendMessage/uploadMedia
    // enforce this server-side regardless, but the composer should say
    // so up front instead of just failing silently on the next send.
    supabase
      .from('message_requests')
      .select('id, sender_id, receiver_id')
      .eq('conversation_id', conversationId)
      .eq('status', 'pending')
      .maybeSingle(),
  ])

  const participant = participantResult.data
  if (!participant) return { error: 'Not a participant' }

  const conversationRow = conversationResult.data
  const { data: participants, error } = participantsResult

  if (error) return { error: error.message }

  const otherParticipants = participants?.map(p => {
    const { privacy_settings, ...userFields } = p.users
    return {
      user_id: p.user_id,
      role: p.role,
      ...userFields,
      show_online_status: privacy_settings?.show_online_status ?? true,
      show_last_seen: privacy_settings?.show_last_seen ?? true,
    }
  }) || []

  const pendingRequest = pendingRequestResult.data

  return {
    data: {
      participants: otherParticipants,
      role: participant.role,
      type: conversationRow?.type,
      pendingRequestAsSender: pendingRequest?.sender_id === user.id,
      pendingRequestAsReceiver: pendingRequest?.receiver_id === user.id,
      pendingRequestId: pendingRequest?.id || null,
    },
  }
}

export async function getMessages(conversationId, page = 0) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const limit = 50
  const offset = page * limit

  // If this user deleted the conversation, only messages sent after that
  // point are visible to them — older history stays hidden even though
  // the conversation itself may have reappeared in their list because a
  // new message arrived (get_user_conversations re-includes it once a
  // message newer than deleted_at exists). Other participants are
  // unaffected since this check is scoped to the current user.
  const { data: deletedRow } = await supabase
    .from('conversation_deleted')
    .select('deleted_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .maybeSingle()

  let query = supabase
    .from('messages')
    .select(`
      id,
      content,
      type,
      sender_id,
      sender_name_snapshot,
      reply_to_id,
      is_edited,
      edited_at,
      created_at,
      media(url, filename, size, mime_type),
      reply:reply_to_id(id, content, sender_name_snapshot, type)
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (deletedRow?.deleted_at) {
    query = query.gt('created_at', deletedRow.deleted_at)
  }

  const { data, error } = await query

  if (error) return { error: error.message }

  const messages = data.reverse().map(({ media, reply, ...msg }) => {
    const mediaRow = Array.isArray(media) ? media[0] : media
    return {
      ...msg,
      media_url: mediaRow?.url || null,
      media_filename: mediaRow?.filename || null,
      media_size: mediaRow?.size || null,
      media_mime_type: mediaRow?.mime_type || null,
      reply: reply || null,
    }
  })

  return { data: messages }
}

export async function sendMessage(conversationId, content, replyToId = null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  content = sanitizeText(content, 2000)
  if (!content) return { error: 'Message cannot be empty' }

  // Verify participant
  const { data: participant } = await supabase
    .from('conversation_participants')
    .select('role')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (!participant) return { error: 'Not a participant' }

  const { blocked, type: conversationType } = await checkDmBlock(supabase, conversationId, user.id)
  if (blocked) return { error: 'Unable to send message' }

  if (await checkPendingRequest(supabase, conversationId)) {
    return { error: 'This message request hasn\'t been accepted yet' }
  }

  // Get sender display name
  const { data: profile } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const messageData = {
    conversation_id: conversationId,
    sender_id: user.id,
    sender_name_snapshot: profile.display_name,
    content: content.trim(),
    type: 'text',
  }

  if (replyToId) messageData.reply_to_id = replyToId

  const { data, error } = await supabase
    .from('messages')
    .insert(messageData)
    .select()
    .single()

  if (error) return { error: error.message }

  // Update last_read_at for sender
  await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)

  // Needed so the generic participant push below can tell sendPushNotification
  // whether to gate on message_notifications or group_notifications.
  const pushType = conversationType === 'group' ? 'group_message' : 'direct_message'

  // Parse mentions, create notifications, and push mentioned users directly
  // (skip them in the generic participant push below to avoid double-notifying)
  const mentionedUserIds = new Set()
  if (content && content.includes('@')) {
    const mentionMatches = content.match(/@([a-z0-9_]+)/g) || []
    for (const mention of mentionMatches) {
      const username = mention.slice(1)
      const { data: mentionedUser } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single()

      if (mentionedUser && mentionedUser.id !== user.id && !mentionedUserIds.has(mentionedUser.id)) {
        mentionedUserIds.add(mentionedUser.id)

        await supabase.from('notifications').insert({
          user_id: mentionedUser.id,
          type: 'mention',
          reference_id: conversationId,
          title: `${profile.display_name} mentioned you`,
          body: content.trim().slice(0, 100),
        })

        sendPushNotification(
          mentionedUser.id,
          `${profile.display_name} mentioned you`,
          content.trim().slice(0, 100),
          `/chat/${conversationId}`,
          conversationId,
          'mention'
        )
      }
    }
  }

  // Send push notifications to other participants (not logged, and not
  // re-sent to anyone already notified above via mention)
  const { data: participants } = await supabase
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .neq('user_id', user.id)

  if (participants?.length) {
    const preview = content.trim().slice(0, 60)
    for (const p of participants) {
      if (mentionedUserIds.has(p.user_id)) continue
      sendPushNotification(
        p.user_id,
        profile.display_name,
        preview,
        `/chat/${conversationId}`,
        conversationId,
        pushType
      )
    }
  }

  return { success: true, data }
}

export async function editMessage(messageId, content) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  content = sanitizeText(content, 2000)
  if (!content) return { error: 'Message cannot be empty' }

  // Verify ownership and time limit
  const { data: message } = await supabase
    .from('messages')
    .select('sender_id, created_at, type')
    .eq('id', messageId)
    .single()

  if (!message) return { error: 'Message not found' }
  if (message.sender_id !== user.id) return { error: 'Not your message' }
  if (message.type === 'deleted') return { error: 'Cannot edit deleted message' }

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
  if (new Date(message.created_at) < fifteenMinutesAgo) {
    return { error: 'Message can only be edited within 15 minutes of sending' }
  }

  const { error } = await supabase
    .from('messages')
    .update({
      content,
      is_edited: true,
      edited_at: new Date().toISOString(),
    })
    .eq('id', messageId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteMessage(messageId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data: message } = await supabase
    .from('messages')
    .select('sender_id, type')
    .eq('id', messageId)
    .single()

  if (!message) return { error: 'Message not found' }
  if (message.sender_id !== user.id) return { error: 'Not your message' }
  if (message.type === 'deleted') return { error: 'Message already deleted' }

  const { error } = await supabase
    .from('messages')
    .update({ type: 'deleted', content: null })
    .eq('id', messageId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function markConversationRead(conversationId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)

  return { success: true }
}

export async function markConversationUnread(conversationId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data: lastMessage } = await supabase
    .from('messages')
    .select('created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // last_read_at just before the last message so the unread-count query
  // (created_at > last_read_at) counts it, without needing a separate
  // unread-tracking table.
  const beforeLastMessage = lastMessage
    ? new Date(new Date(lastMessage.created_at).getTime() - 1000).toISOString()
    : null

  await supabase
    .from('conversation_participants')
    .update({ last_read_at: beforeLastMessage })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)

  return { success: true }
}

export async function hideConversation(conversationId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  await supabase
    .from('conversation_hidden')
    .upsert({
      conversation_id: conversationId,
      user_id: user.id,
      hidden_at: new Date().toISOString(),
    })

  return { success: true }
}

export async function unhideConversation(conversationId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  await supabase
    .from('conversation_hidden')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)

  return { success: true }
}

export async function getHiddenConversations() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase.rpc('get_hidden_conversations', {
    p_user_id: user.id,
  })

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function getHiddenConversationCount() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { count: 0 }

  // A raw conversation_hidden count would also count pending message
  // requests, which are hidden from the receiver's main list for an
  // unrelated reason (see create_message_request) — this RPC excludes
  // those, matching get_hidden_conversations' own exclusion.
  const { data: count, error } = await supabase.rpc('get_hidden_conversation_count', {
    p_user_id: user.id,
  })

  if (error) return { count: 0 }
  return { count: count || 0 }
}

export async function getExistingConversation(otherUserId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { conversationId: null }

  const { data, error } = await supabase.rpc('get_existing_dm', {
    p_user_id: user.id,
    p_other_user_id: otherUserId,
  })

  if (error || !data) return { conversationId: null }
  return { conversationId: data }
}

export async function uploadMedia(conversationId, formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const file = formData.get('file')
  if (!file) return { error: 'No file provided' }

  const replyToId = formData.get('replyToId') || null

  // Validate file type and size
  const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  const audioTypes = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm']
  const fileTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip',
  ]

  let messageType = null
  let maxSize = 0

  if (imageTypes.includes(file.type)) {
    messageType = 'image'
    maxSize = 10 * 1024 * 1024
  } else if (audioTypes.includes(file.type)) {
    messageType = 'audio'
    maxSize = 10 * 1024 * 1024
  } else if (fileTypes.includes(file.type)) {
    messageType = 'file'
    maxSize = 50 * 1024 * 1024
  } else {
    return { error: 'Unsupported file type' }
  }

  if (file.size > maxSize) {
    const limitMB = maxSize / (1024 * 1024)
    return { error: `File too large. Maximum size is ${limitMB}MB` }
  }

  // Verify participant
  const { data: participant } = await supabase
    .from('conversation_participants')
    .select('role')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (!participant) return { error: 'Not a participant' }

  const { blocked } = await checkDmBlock(supabase, conversationId, user.id)
  if (blocked) return { error: 'Unable to send message' }

  if (await checkPendingRequest(supabase, conversationId)) {
    return { error: 'This message request hasn\'t been accepted yet' }
  }

  // Get sender display name
  const { data: profile } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', user.id)
    .single()

  // Upload to Supabase Storage
  const ext = file.name.split('.').pop()
  const path = `${conversationId}/${user.id}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(path, file)

  if (uploadError) return { error: uploadError.message }

  const { data: { publicUrl } } = supabase.storage
    .from('media')
    .getPublicUrl(path)

  // Create message
  const messageData = {
    conversation_id: conversationId,
    sender_id: user.id,
    sender_name_snapshot: profile.display_name,
    content: file.name,
    type: messageType,
  }

  if (replyToId) messageData.reply_to_id = replyToId

  const { data: message, error: msgError } = await supabase
    .from('messages')
    .insert(messageData)
    .select()
    .single()

  if (msgError) return { error: msgError.message }

  // Create media record
  await supabase.from('media').insert({
    message_id: message.id,
    url: publicUrl,
    type: messageType,
    mime_type: file.type,
    filename: file.name,
    size: file.size,
  })

  return { success: true, data: message }
}

export async function getMediaForMessage(messageId) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('media')
    .select('*')
    .eq('message_id', messageId)
    .single()

  if (error) return { error: error.message }
  return { data }
}

export async function toggleReaction(messageId, emoji) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }
  if (!emoji) return { error: 'Emoji is required' }

  const { data: existing } = await supabase
    .from('message_reactions')
    .select('id, emoji')
    .eq('message_id', messageId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    if (existing.emoji === emoji) {
      await supabase
        .from('message_reactions')
        .delete()
        .eq('id', existing.id)
      return { success: true, action: 'removed' }
    } else {
      await supabase
        .from('message_reactions')
        .update({ emoji })
        .eq('id', existing.id)
      return { success: true, action: 'changed' }
    }
  } else {
    await supabase
      .from('message_reactions')
      .insert({ message_id: messageId, user_id: user.id, emoji })
    return { success: true, action: 'added' }
  }
}

export async function getReactions(messageId) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('message_reactions')
    .select('emoji, user_id, users(display_name)')
    .eq('message_id', messageId)

  if (error) return { error: error.message }
  return { data }
}

export async function togglePin(conversationId, messageId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data: participant } = await supabase
    .from('conversation_participants')
    .select('role')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (!participant) return { error: 'Not a participant' }

  const { data: conv } = await supabase
    .from('conversations')
    .select('type')
    .eq('id', conversationId)
    .single()

  if (conv.type === 'group' && !['admin', 'owner'].includes(participant.role)) {
    return { error: 'Only admins and owners can pin messages in groups' }
  }

  const { data: existing } = await supabase
    .from('pinned_messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('message_id', messageId)
    .maybeSingle()

  if (existing) {
    await supabase.from('pinned_messages').delete().eq('id', existing.id)
    return { success: true, action: 'unpinned' }
  }

  const { data: count } = await supabase
    .from('pinned_messages')
    .select('id', { count: 'exact' })
    .eq('conversation_id', conversationId)

  if (count?.length >= 5) {
    return { error: 'Maximum 5 pinned messages per conversation' }
  }

  await supabase.from('pinned_messages').insert({
    conversation_id: conversationId,
    message_id: messageId,
    pinned_by: user.id,
  })

  const { data: profile } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', user.id)
    .single()

  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: null,
    sender_name_snapshot: 'System',
    content: `${profile.display_name} pinned a message`,
    type: 'system',
  })

  return { success: true, action: 'pinned' }
}

export async function getPinnedMessages(conversationId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('pinned_messages')
    .select(`
      id,
      created_at,
      pinned_by,
      messages(id, content, type, sender_name_snapshot, created_at),
      users!pinned_messages_pinned_by_fkey(display_name)
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { data }
}

export async function searchMessages(conversationId, query) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }
  if (!query || query.trim().length < 2) return { error: 'Search query too short' }

  const { data: participant } = await supabase
    .from('conversation_participants')
    .select('role')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (!participant) return { error: 'Not a participant' }

  const { data, error } = await supabase
    .from('messages')
    .select('id, content, type, sender_name_snapshot, created_at')
    .eq('conversation_id', conversationId)
    .neq('type', 'deleted')
    .neq('type', 'system')
    .ilike('content', `%${query.trim()}%`)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return { error: error.message }
  return { data }
}