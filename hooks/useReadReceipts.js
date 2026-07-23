'use client'

import { useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { markConversationRead } from '@/actions/messages'

export function useReadReceipts(conversationId, userId, messages) {
  const supabase = createClient()

  const markRead = useCallback(async () => {
    if (!conversationId || !userId) return
    await markConversationRead(conversationId)

    const unreadMessages = messages?.filter(
      m => m.sender_id !== userId && m.type !== 'deleted' && m.type !== 'system'
    )

    if (!unreadMessages?.length) return

    const reads = unreadMessages.map(m => ({
      message_id: m.id,
      user_id: userId,
      read_at: new Date().toISOString(),
    }))

    await supabase
      .from('message_reads')
      .upsert(reads, { onConflict: 'message_id,user_id', ignoreDuplicates: true })
  }, [conversationId, userId, messages])

  useEffect(() => {
    markRead()
  }, [markRead])

  return { markRead }
}