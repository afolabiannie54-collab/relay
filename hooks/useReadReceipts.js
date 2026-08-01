'use client'

import { useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { markConversationRead } from '@/actions/messages'

export function useReadReceipts(conversationId, userId, messages) {
  const supabase = createClient()

  const markRead = useCallback(async () => {
    if (!conversationId || !userId) return
    // A backgrounded/minimized tab shouldn't silently record read
    // receipts for messages the user hasn't actually seen — the
    // visibilitychange listener below re-runs this once the tab is
    // genuinely foregrounded again.
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return

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

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') markRead()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [markRead])

  return { markRead }
}
