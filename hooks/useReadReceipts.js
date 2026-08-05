'use client'

import { useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { markConversationRead } from '@/actions/messages'

// `messages` is the FULL loaded array for this conversation, which grows
// two different ways: new messages appended at the tail (arrived while
// the user is here — genuinely seen) and older messages prepended by
// scroll-up pagination (fetched into memory, but never actually looked
// at). The two must not be treated the same, or scrolling up through
// history silently marks all of it "read" the instant it's fetched.
//
// lastProcessedAtRef is a `created_at` cursor: on the first run for a
// conversation it marks whatever's currently loaded (the visible tail —
// this app opens scrolled to bottom, so that's a fair proxy for "on
// screen", same as opening a chat in WhatsApp marks it read). After that,
// only messages with created_at PAST the cursor count — paginated-in
// older messages always sort before it and are excluded automatically,
// while new arrivals always sort after it. ISO 8601 strings compare
// correctly as plain strings, so no Date parsing is needed here.
// showReadReceipts is tri-state: true (on), false (off), null (not loaded
// yet). Writing is only ever allowed on an explicit true — see the guard
// below.
export function useReadReceipts(conversationId, userId, messages, showReadReceipts = null) {
  const supabase = createClient()
  const lastProcessedAtRef = useRef(null)

  useEffect(() => {
    lastProcessedAtRef.current = null
  }, [conversationId])

  const markRead = useCallback(async () => {
    if (!conversationId || !userId) return
    // A backgrounded/minimized tab shouldn't silently record read
    // receipts for messages the user hasn't actually seen — the
    // visibilitychange listener below re-runs this once the tab is
    // genuinely foregrounded again.
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return

    await markConversationRead(conversationId)

    if (!messages?.length) return

    const cursor = lastProcessedAtRef.current
    const candidates = cursor === null ? messages : messages.filter(m => m.created_at > cursor)

    // Cursor always advances to the latest created_at seen, regardless of
    // sender — otherwise a batch containing only the other person's
    // messages would never move it past their own most recent send.
    const maxCreatedAt = messages.reduce((max, m) => (!max || m.created_at > max) ? m.created_at : max, cursor)
    lastProcessedAtRef.current = maxCreatedAt

    const unreadMessages = candidates.filter(
      m => m.sender_id !== userId && m.type !== 'deleted' && m.type !== 'system'
    )

    if (!unreadMessages.length) return

    // Reciprocal, like WhatsApp: the cursor still advances (so re-enabling
    // this later doesn't suddenly flood message_reads with a backlog of
    // everything read while it was off), but no row actually gets written
    // — turning this off means not sending read receipts at all, not
    // sending them late.
    //
    // Strict === true, so the not-yet-loaded (null) case blocks writing
    // too. A read receipt is permanent and unretractable, so writing one
    // on the assumption that the setting is probably on would leak reads
    // for anyone who has it off, every time they open a conversation.
    if (showReadReceipts !== true) return

    const reads = unreadMessages.map(m => ({
      message_id: m.id,
      user_id: userId,
      read_at: new Date().toISOString(),
    }))

    await supabase
      .from('message_reads')
      .upsert(reads, { onConflict: 'message_id,user_id', ignoreDuplicates: true })
  }, [conversationId, userId, messages, showReadReceipts])

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
