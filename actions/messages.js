'use server'

import { createClient } from '@/lib/supabase/server'

export async function sendMessageRequest(receiverId, content) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase.rpc('create_message_request', {
    p_receiver_id: receiverId,
    p_content: content,
  })

  if (error) return { error: error.message }
  if (data.error) return { error: data.error, conversationId: data.conversationId }

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

  // Remove from hidden conversations
  await supabase
    .from('conversation_hidden')
    .delete()
    .eq('conversation_id', request.conversation_id)
    .eq('user_id', user.id)

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

export async function getConversation(conversationId) {
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

  const { data: conversationRow } = await supabase
    .from('conversations')
    .select('type')
    .eq('id', conversationId)
    .single()

  const { data: participants, error } = await supabase
    .from('conversation_participants')
    .select(`
      user_id,
      role,
      users!inner(id, username, display_name, avatar_url, last_seen)
    `)
    .eq('conversation_id', conversationId)
    .neq('user_id', user.id)

  if (error) return { error: error.message }

  const otherParticipants = participants?.map(p => ({
    user_id: p.user_id,
    role: p.role,
    ...p.users,
  })) || []

  return { data: { participants: otherParticipants, role: participant.role, type: conversationRow?.type } }
}

export async function getMessages(conversationId, page = 0) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const limit = 50
  const offset = page * limit

  const { data, error } = await supabase
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
      created_at
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return { error: error.message }

  const messages = data.reverse()

  const messagesWithReplies = await Promise.all(
    messages.map(async (msg) => {
      if (!msg.reply_to_id) return { ...msg, reply: null }
      const { data: reply } = await supabase
        .from('messages')
        .select('id, content, sender_name_snapshot, type')
        .eq('id', msg.reply_to_id)
        .single()
      return { ...msg, reply: reply || null }
    })
  )

  return { data: messagesWithReplies }
}

export async function sendMessage(conversationId, content, replyToId = null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }
  if (!content?.trim()) return { error: 'Message cannot be empty' }

  // Verify participant
  const { data: participant } = await supabase
    .from('conversation_participants')
    .select('role')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (!participant) return { error: 'Not a participant' }

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

  return { success: true, data }
}

export async function editMessage(messageId, content) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }
  if (!content?.trim()) return { error: 'Message cannot be empty' }

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
      content: content.trim(),
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