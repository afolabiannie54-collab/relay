'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  MoreHorizontal, Bell, Plus, Search, Inbox, EyeOff, X,
  CheckSquare, Check, BellOff, Trash2, Image as ImageIcon, Music, Paperclip,
} from 'lucide-react'
import Avatar from '@/components/shared/Avatar'
import EmptyChatsIllustration from '@/components/shared/illustrations/EmptyChatsIllustration'
import ChatLink from '@/components/chat/ChatLink'
import NewConversationSheet from '@/components/chat/NewConversationSheet'
import ConversationActionSheet from '@/components/chat/ConversationActionSheet'
import ConversationContextMenu from '@/components/chat/ConversationContextMenu'
import ConfirmSheet from '@/components/shared/ConfirmSheet'
import { getConversations, getMessages, getHiddenConversationCount, markConversationRead, hideConversation } from '@/actions/messages'
import { getMutedConversationIds, muteConversation, deleteConversationForUser } from '@/actions/conversations'
import { getUnreadCount as getUnreadNotificationCount, getRequestsCount } from '@/actions/notifications'
import { createClient } from '@/lib/supabase/client'
import { cache } from '@/lib/cache'

const LONG_PRESS_MS = 400
const LONG_PRESS_MOVE_TOLERANCE = 10

export default function ChatList({ onSelectConversation }) {
  const router = useRouter()
  const [conversations, setConversations] = useState([])
  const [userId, setUserId] = useState(null)
  const [mutedIds, setMutedIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterQuery, setFilterQuery] = useState('')
  const [actionSheetConv, setActionSheetConv] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const longPressTimerRef = useRef(null)
  const longPressStartRef = useRef(null)
  const longPressFiredRef = useRef(false)
  const [unreadNotifCount, setUnreadNotifCount] = useState(0)
  const [requestsCount, setRequestsCount] = useState(0)
  const [hiddenCount, setHiddenCount] = useState(0)
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [showListMenu, setShowListMenu] = useState(false)
  const [bulkSelectMode, setBulkSelectMode] = useState(false)
  const [selectedConvIds, setSelectedConvIds] = useState(new Set())
  const [bulkConfirmAction, setBulkConfirmAction] = useState(null)
  const [bulkActing, setBulkActing] = useState(false)

  // Tells app/(main)/layout.js to hide the bottom tab bar while this is
  // active — WhatsApp replaces its tab bar with the bulk-action bar
  // rather than showing both at once, and the two components are too
  // far apart in the tree to share this via props alone. The cleanup
  // fires false on unmount so navigating away mid-select doesn't leave
  // the tab bar permanently hidden.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('relay:bulk-select-mode', { detail: { active: bulkSelectMode } }))
    return () => {
      window.dispatchEvent(new CustomEvent('relay:bulk-select-mode', { detail: { active: false } }))
    }
  }, [bulkSelectMode])

  useEffect(() => {
    async function load() {
      // Paint cached data immediately — no spinner for a list we've
      // already fetched this session. Fresh data still loads underneath
      // and replaces it silently. Uses peek() rather than get() since we
      // always re-fetch fresh below regardless of TTL — the TTL shouldn't
      // also gate whether we get to show something instantly.
      const cachedConvs = cache.peek('conversations')
      const cachedMuted = cache.get('muted-ids')

      if (cachedConvs) {
        setConversations(cachedConvs)
        setLoading(false)
      }
      if (cachedMuted) setMutedIds(cachedMuted)

      const supabase = createClient()

      const [userResult, convsResult, mutedResult, notifResult, requestsResult, hiddenResult] = await Promise.all([
        supabase.auth.getUser(),
        getConversations(),
        cachedMuted ? Promise.resolve({ data: cachedMuted }) : getMutedConversationIds(),
        getUnreadNotificationCount(),
        getRequestsCount(),
        getHiddenConversationCount(),
      ])

      if (userResult.data.user) setUserId(userResult.data.user.id)

      if (convsResult.data) {
        setConversations(convsResult.data)
        cache.set('conversations', convsResult.data, 10000)
      }
      if (mutedResult.data) {
        setMutedIds(mutedResult.data)
        cache.set('muted-ids', mutedResult.data, 30000)
      }
      setUnreadNotifCount(notifResult.count || 0)
      setRequestsCount(requestsResult.count || 0)
      setHiddenCount(hiddenResult.count || 0)
      setLoading(false)
    }
    load()
  }, [])

  async function refreshConversations() {
    const result = await getConversations()
    if (result.data) {
      setConversations(result.data)
      cache.set('conversations', result.data, 10000)
    }
  }

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        cache.invalidate('conversations')
        refreshConversations()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleVisibility)
    }
  }, [])

  // Single consolidated realtime channel for everything this list needs —
  // previously split across two separate supabase.channel() calls, each
  // its own effect, each opening its own socket. That's why
  // realtime.subscription showed duplicate entries per table even after
  // createClient() became a singleton: two genuinely separate channels
  // really were being subscribed for the same user. One channel with
  // every .on() listener means one subscription per table per user.
  // Gated on userId since most of these filters need it — the messages
  // listener doesn't strictly require it, but folding it in here costs
  // only the brief delay before userId resolves on initial load.
  useEffect(() => {
    if (!userId) return

    // Same-tab signal fired the instant a conversation is marked read —
    // guarantees this list reflects it immediately regardless of whether
    // the browser actually remounts this component on back-navigation.
    // Zeroes out just the matching tile locally instead of a full
    // refetch — a refetch here would race the messages-INSERT listener's
    // own full refetch below (both can fire within the same moment when
    // you open a conversation with a message already in flight), which
    // was flashing the badge from 0 to 1 and back. Falls back to a full
    // refresh if the event has no conversationId, so any future caller
    // that dispatches a plain Event still gets the old behavior.
    const handleConversationRead = (e) => {
      const convId = e.detail?.conversationId
      if (!convId) { refreshConversations(); return }
      setConversations(prev => {
        const next = prev.map(c => c.conversation_id === convId ? { ...c, unread_count: 0 } : c)
        cache.set('conversations', next, 10000)
        return next
      })
    }
    window.addEventListener('relay:conversation-read', handleConversationRead)

    // Same idea, fired by whoever just deleted/left a group themselves
    // (ConversationSettingsSheet, groups/[id]/settings/page.js). Deleting
    // a group removes every participant row in one go, and Realtime's
    // authorization check for delivering that DELETE event re-queries
    // conversation_participants to confirm the subscriber was a member —
    // which by then has already been emptied by the same deletion, so
    // the event never reaches anyone, regardless of REPLICA IDENTITY.
    // This same-tab event guarantees the person who took the action sees
    // their own list update instantly without depending on Realtime at
    // all; other participants still need Realtime (or a reload) to find
    // out.
    window.addEventListener('relay:conversations-changed', refreshConversations)

    const supabase = createClient()

    const channel = supabase
      .channel('chat-list-all')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, async (payload) => {
        // A blanket refreshConversations() here would overwrite EVERY
        // row with whatever this fetch returns. If that fetch was
        // already in flight when a *different* conversation's read got
        // marked (e.g. you open conversation A right as conversation B
        // gets a new message elsewhere), its stale response could land
        // afterward and clobber A's just-cleared badge back to unread —
        // it would only self-correct on the next unrelated trigger,
        // which read as "the badge takes forever to clear." Only ever
        // writing the one row this INSERT is actually about avoids that
        // race regardless of fetch ordering.
        const convId = payload.new.conversation_id
        cache.invalidate('conversations')
        const result = await getConversations()
        const updated = result.data?.find(c => c.conversation_id === convId)
        if (!updated) return
        setConversations(prev => {
          const next = prev.some(c => c.conversation_id === convId)
            ? prev.map(c => c.conversation_id === convId ? updated : c)
            : [updated, ...prev]
          cache.set('conversations', next, 10000)
          return next
        })
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        setUnreadNotifCount(c => c + 1)
        // A DB trigger inserts this when a group the user was in gets
        // deleted, so their list updates instantly without depending on
        // conversation_participants DELETE Realtime — which never fires
        // for other participants since the RLS check that authorizes
        // delivery re-queries a table the same deletion already emptied.
        if (payload.new.type === 'group_removed') {
          cache.invalidate('conversations')
          refreshConversations()
        }
      })
      // The badge only ever incremented on INSERT — marking a
      // notification read (NotificationList.js, single or "mark all")
      // never decremented it, so it stayed stuck until this component
      // remounted. notifications has REPLICA IDENTITY FULL, so
      // payload.old carries the pre-update row and this can tell a
      // genuine false->true read transition apart from any other update.
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        if (payload.new.read === true && payload.old.read === false) {
          setUnreadNotifCount(c => Math.max(0, c - 1))
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_requests',
        filter: `receiver_id=eq.${userId}`,
      }, async () => {
        const result = await getRequestsCount()
        setRequestsCount(result.count || 0)
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_invites',
        filter: `invitee_id=eq.${userId}`,
      }, async () => {
        const result = await getRequestsCount()
        setRequestsCount(result.count || 0)
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversation_hidden',
        filter: `user_id=eq.${userId}`,
      }, async () => {
        const result = await getHiddenConversationCount()
        setHiddenCount(result.count || 0)
      })
      // Fires whenever the current user is added as a participant to any
      // conversation — new group creation, being added to an existing
      // group, or an accepted message request. Without this, the list
      // only picked up a brand new conversation on the next message
      // INSERT (the other realtime listener above), which never fires
      // for a group that's just been created with no messages yet.
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversation_participants',
        filter: `user_id=eq.${userId}`,
      }, () => {
        cache.invalidate('conversations')
        refreshConversations()
      })
      // Mirrors the INSERT listener above for the opposite case — the
      // current user's own participant row being removed (e.g. the
      // owner deleting a group they were in). Without this, a deleted
      // group stayed in the owner's own list until a manual refresh.
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'conversation_participants',
        filter: `user_id=eq.${userId}`,
      }, () => {
        cache.invalidate('conversations')
        refreshConversations()
      })
      .subscribe()

    return () => {
      window.removeEventListener('relay:conversation-read', handleConversationRead)
      window.removeEventListener('relay:conversations-changed', refreshConversations)
      supabase.removeChannel(channel)
    }
  }, [userId])

  async function prefetchConversation(convId) {
    if (cache.get(`messages:${convId}`)) return
    const result = await getMessages(convId)
    if (result.data) cache.set(`messages:${convId}`, result.data, 20000)
  }

  const handleRowTouchStart = (conv) => (e) => {
    if (bulkSelectMode) return
    const touch = e.touches[0]
    if (!touch) return
    longPressFiredRef.current = false
    longPressStartRef.current = { x: touch.clientX, y: touch.clientY }
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true
      try { window.navigator.vibrate?.(10) } catch {}
      setActionSheetConv(conv)
    }, LONG_PRESS_MS)
  }

  const handleRowTouchMove = (e) => {
    if (!longPressStartRef.current || !longPressTimerRef.current) return
    const touch = e.touches[0]
    if (!touch) return
    const dx = Math.abs(touch.clientX - longPressStartRef.current.x)
    const dy = Math.abs(touch.clientY - longPressStartRef.current.y)
    if (dx > LONG_PRESS_MOVE_TOLERANCE || dy > LONG_PRESS_MOVE_TOLERANCE) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleRowTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  // Suppresses the tile's own navigation when the touch that just ended
  // was a long press (which already opened the action sheet) rather than
  // a tap. In bulk-select mode, a tap toggles the tile's selection
  // instead of navigating.
  const handleRowClick = (conv) => (e) => {
    if (bulkSelectMode) {
      e.preventDefault()
      toggleSelectConv(conv.conversation_id)
      return
    }
    if (longPressFiredRef.current) {
      e.preventDefault()
      longPressFiredRef.current = false
      return
    }
    onSelectConversation?.(conv.conversation_id)
  }

  const handleRowContextMenu = (conv) => (e) => {
    if (bulkSelectMode) return
    e.preventDefault()
    setContextMenu({ conversation: conv, position: { x: e.clientX, y: e.clientY } })
  }

  const handleEnterBulkSelect = (conv) => {
    setBulkSelectMode(true)
    setSelectedConvIds(new Set(conv ? [conv.conversation_id] : []))
  }

  const handleExitBulkSelect = () => {
    setBulkSelectMode(false)
    setSelectedConvIds(new Set())
  }

  const toggleSelectConv = (convId) => {
    setSelectedConvIds(prev => {
      const next = new Set(prev)
      if (next.has(convId)) next.delete(convId)
      else next.add(convId)
      return next
    })
  }

  const handleReadAll = async () => {
    setShowListMenu(false)
    const unreadIds = conversations
      .filter(c => (c.unread_count || 0) > 0)
      .map(c => c.conversation_id)
    if (unreadIds.length === 0) return
    await Promise.all(unreadIds.map(id => markConversationRead(id)))
    await refreshConversations()
  }

  const handleBulkMarkRead = async () => {
    setBulkActing(true)
    await Promise.all([...selectedConvIds].map(id => markConversationRead(id)))
    await refreshConversations()
    setBulkActing(false)
    handleExitBulkSelect()
  }

  const handleBulkHide = async () => {
    setBulkActing(true)
    await Promise.all([...selectedConvIds].map(id => hideConversation(id)))
    await refreshConversations()
    setBulkActing(false)
    handleExitBulkSelect()
  }

  const handleBulkMute = async () => {
    setBulkActing(true)
    await Promise.all([...selectedConvIds].map(id => muteConversation(id, null)))
    cache.invalidate('muted-ids')
    const mutedResult = await getMutedConversationIds()
    if (mutedResult.data) setMutedIds(mutedResult.data)
    setBulkActing(false)
    handleExitBulkSelect()
  }

  const handleBulkDelete = async () => {
    setBulkActing(true)
    await Promise.all([...selectedConvIds].map(id => deleteConversationForUser(id)))
    // A stale cached page of messages (from before the deletion cutoff)
    // would otherwise serve the full unfiltered history on next open,
    // since getMessages()'s deleted_at filter only ever runs on an
    // actual server fetch, not a cache hit.
    for (const id of selectedConvIds) cache.invalidate(`messages:${id}`)
    await refreshConversations()
    setBulkActing(false)
    setBulkConfirmAction(null)
    handleExitBulkSelect()
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date
    const days = Math.floor(diff / 86400000)
    if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (days === 1) return 'Yesterday'
    if (days < 7) return date.toLocaleDateString([], { weekday: 'short' })
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  const getLastMessagePreview = (msg) => {
    if (!msg) return 'No messages yet'
    if (msg.type === 'deleted') return 'This message was deleted'
    if (msg.type === 'system') return msg.content
    if (msg.type === 'image') return { icon: ImageIcon, text: 'Photo' }
    if (msg.type === 'audio') return { icon: Music, text: 'Voice message' }
    if (msg.type === 'file') return { icon: Paperclip, text: 'File' }
    return msg.content || ''
  }

  const getUnreadCount = (conv) => conv.unread_count || 0

  const filteredConversations = useMemo(() => {
    const q = filterQuery.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(conv => {
      const isGroup = conv.type === 'group'
      const otherUser = conv.other_participants?.[0]
      const name = (isGroup ? conv.group_info?.name : otherUser?.display_name) || ''
      const lastMessageContent = conv.last_message?.content || ''
      return (
        name.toLowerCase().includes(q) ||
        lastMessageContent.toLowerCase().includes(q)
      )
    })
  }, [conversations, filterQuery])

  if (loading) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Header */}
      {bulkSelectMode ? (
        <div className="relay-fade-in" style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <button
            onClick={handleExitBulkSelect}
            aria-label="Exit select mode"
            className="relay-icon-btn"
            style={{ border: 'none', background: 'none' }}
          >
            <X size={20} strokeWidth={2.25} />
          </button>
          <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', letterSpacing: '-0.01em' }}>
            {selectedConvIds.size} selected
          </p>
        </div>
      ) : (
      <div style={{
        padding: '14px 20px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
      }}>
        {/* Icon toolbar — its own row, not sharing space with the title,
            so neither is cramped (matches WhatsApp's layout: a menu
            button on one side and the action icons on the other, on a
            row above the title). */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowListMenu(v => !v)}
              aria-label="Chat list options"
              className="relay-icon-btn"
            >
              <MoreHorizontal size={19} strokeWidth={2.25} />
            </button>
            {showListMenu && (
              <>
                <div
                  onClick={() => setShowListMenu(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                />
                <div className="relay-popover" style={{
                  position: 'absolute',
                  top: '48px',
                  left: 0,
                  minWidth: '178px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  boxShadow: 'var(--shadow-popover)',
                  zIndex: 11,
                  padding: '6px',
                  transformOrigin: 'top left',
                }}>
                  <button
                    onClick={() => { setShowListMenu(false); handleEnterBulkSelect(null) }}
                    className="relay-menu-row"
                    style={{ color: 'var(--text)' }}
                  >
                    <CheckSquare size={15} strokeWidth={2.25} /> Select chats
                  </button>
                  <button
                    onClick={handleReadAll}
                    className="relay-menu-row"
                    style={{ color: 'var(--text)' }}
                  >
                    <Check size={15} strokeWidth={2.25} /> Read all
                  </button>
                </div>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => router.push('/notifications')}
              aria-label="Notifications"
              className="relay-icon-btn"
              style={{ position: 'relative' }}
            >
              <Bell size={18} strokeWidth={2.25} />
              {unreadNotifCount > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  minWidth: '17px',
                  height: '17px',
                  padding: '0 4px',
                  background: 'var(--accent)',
                  border: '2px solid var(--surface)',
                  borderRadius: '100px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  fontWeight: '800',
                  color: 'var(--foreground)',
                }}>
                  {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                </div>
              )}
            </button>
            <button
              onClick={() => setShowNewConversation(true)}
              aria-label="New conversation"
              className="relay-icon-btn"
              style={{ background: 'var(--text)', color: 'var(--background)', border: 'none' }}
            >
              <Plus size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Title — its own row underneath, full width, no longer sharing
            the line with the icons. */}
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.02em' }}>Messages</h1>
      </div>
      )}

      {/* Filter bar */}
      {!bulkSelectMode && (
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-light)', background: 'var(--surface)' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={15}
              strokeWidth={2.25}
              style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }}
            />
            <input
              type="text"
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
              placeholder="Search conversations…"
              className="relay-input"
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '13.5px',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      )}

      {/* Conversation list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        overscrollBehaviorX: 'none',
        overscrollBehaviorY: 'contain',
        WebkitOverflowScrolling: 'touch',
      }}>
        {!bulkSelectMode && requestsCount > 0 && (
          <div
            onClick={() => router.push('/requests')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 20px',
              borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
              background: 'var(--accent-light)',
              transition: 'background 0.12s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.97)'}
            onMouseLeave={e => e.currentTarget.style.filter = 'none'}
          >
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: 'var(--foreground)',
            }}>
              <Inbox size={18} strokeWidth={2.25} />
            </div>
            <p style={{ flex: 1, fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>
              Message Requests
            </p>
            <div style={{
              minWidth: '22px',
              height: '22px',
              padding: '0 6px',
              background: 'var(--text)',
              borderRadius: '100px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: '800',
              color: 'var(--background)',
            }}>
              {requestsCount > 99 ? '99+' : requestsCount}
            </div>
          </div>
        )}

        {conversations.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '40px',
            textAlign: 'center',
          }}>
            <div style={{ marginBottom: '8px' }}>
              <EmptyChatsIllustration />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', marginBottom: '6px', letterSpacing: '-0.01em' }}>No conversations yet</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '24px', maxWidth: '260px' }}>
              Search for people and start a conversation.
            </p>
            <button
              onClick={() => setShowNewConversation(true)}
              style={{
                padding: '11px 22px',
                background: 'var(--text)',
                color: 'var(--background)',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                fontSize: '14px',
                fontWeight: '700',
                boxShadow: 'var(--shadow-md)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'transform 0.1s ease',
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              Find people
            </button>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>No conversations match "{filterQuery}"</p>
          </div>
        ) : (
          filteredConversations.map(conv => {
            const lastMessage = conv.last_message
            const isGroup = conv.type === 'group'
            const otherUser = conv.other_participants?.[0]
            const displayName = isGroup ? conv.group_info?.name : otherUser?.display_name
            const avatarUrl = isGroup ? conv.group_info?.avatar_url : otherUser?.avatar_url
            const isMuted = mutedIds.includes(conv.conversation_id)
            const isSelected = selectedConvIds.has(conv.conversation_id)
            const preview = getLastMessagePreview(lastMessage)
            const PreviewIcon = preview?.icon

            return (
              <ChatLink
                key={conv.conversation_id}
                href={`/chat/${conv.conversation_id}`}
                style={{ textDecoration: 'none' }}
                onClick={handleRowClick(conv)}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '13px 20px',
                    borderBottom: '1px solid var(--border-light)',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--accent-light)' : 'var(--surface)',
                    transition: 'background 0.1s',
                  }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--surface-hover)'
                      prefetchConversation(conv.conversation_id)
                    }}
                    onMouseLeave={e => { e.currentTarget.style.background = isSelected ? 'var(--accent-light)' : 'var(--surface)' }}
                    onTouchStart={(e) => { prefetchConversation(conv.conversation_id); handleRowTouchStart(conv)(e) }}
                    onTouchMove={handleRowTouchMove}
                    onTouchEnd={handleRowTouchEnd}
                    onContextMenu={handleRowContextMenu(conv)}
                  >
                  {bulkSelectMode && (
                    <div
                      aria-hidden="true"
                      className="relay-fade-in"
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        border: isSelected ? 'none' : '1.5px solid var(--border-strong)',
                        background: isSelected ? 'var(--text)' : 'transparent',
                        color: 'var(--background)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isSelected && <Check size={13} strokeWidth={3} />}
                    </div>
                  )}
                  <Avatar
                    src={avatarUrl}
                    name={displayName}
                    size={48}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <p style={{
                        fontSize: '15px',
                        fontWeight: '700',
                        color: 'var(--text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}>
                        <span style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {displayName || 'Unknown'}
                        </span>
                        {isMuted && <BellOff size={12} strokeWidth={2.25} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />}
                      </p>
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: '8px' }}>
                        {formatTime(lastMessage?.created_at)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{
                        fontSize: '13px',
                        color: getUnreadCount(conv) > 0 ? 'var(--text)' : 'var(--text-tertiary)',
                        fontWeight: getUnreadCount(conv) > 0 ? '600' : '400',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}>
                        {lastMessage?.sender_id === userId ? 'You: ' : ''}
                        {PreviewIcon && <PreviewIcon size={13} strokeWidth={2.25} style={{ flexShrink: 0 }} />}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {PreviewIcon ? preview.text : preview}
                        </span>
                      </p>
                      {getUnreadCount(conv) > 0 && (
                        <div style={{
                          minWidth: '19px',
                          height: '19px',
                          padding: '0 6px',
                          background: 'var(--accent)',
                          borderRadius: '100px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: '800',
                          color: 'var(--foreground)',
                          flexShrink: 0,
                          marginLeft: '8px',
                        }}>
                          {getUnreadCount(conv) > 99 ? '99+' : getUnreadCount(conv)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </ChatLink>
            )
          })
        )}

        {/* Always visible, unlike the conditional Message Requests row —
            hidden chats aren't a transient state to clear, they're a
            permanent shelf users should always be able to find. */}
        {!bulkSelectMode && (
          <div
            onClick={() => router.push('/chat/hidden')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 20px',
              cursor: 'pointer',
              background: 'var(--surface)',
              transition: 'background 0.12s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
          >
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'var(--gray-100)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: 'var(--text-secondary)',
            }}>
              <EyeOff size={17} strokeWidth={2.25} />
            </div>
            <p style={{ flex: 1, fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>
              Hidden chats
            </p>
            {hiddenCount > 0 && (
              <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: '600' }}>
                {hiddenCount > 99 ? '99+' : hiddenCount}
              </span>
            )}
          </div>
        )}

      </div>

      {/* A normal flex sibling (flexShrink:0) of the scrollable list
          above, not part of its scroll content and not position:sticky
          — sticky only holds an element in view once its container is
          actually scrolled past that point, which never happens here
          when the list is short (e.g. just 2 conversations), so it was
          rendering inline right after the last tile with a large empty
          gap below it instead of pinned to the bottom of the screen.
          As a flex column sibling, it naturally sits at the true bottom
          of this panel — which now correctly ends right above the app
          shell's bottom nav bar since chat-list-panel's height was
          fixed too (see chat/layout.js). */}
      {bulkSelectMode && (
        <div
          className="bulk-action-bar relay-fade-in"
          style={{
            flexShrink: 0,
            display: 'flex',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface)',
            boxShadow: '0 -4px 16px rgba(25,25,25,0.05)',
          }}
        >
          <button
            onClick={handleBulkMarkRead}
            disabled={selectedConvIds.size === 0 || bulkActing}
            style={bulkActionBtnStyle(selectedConvIds.size === 0 || bulkActing)}
          >
            <Check size={17} strokeWidth={2.25} /> Read
          </button>
          <button
            onClick={handleBulkMute}
            disabled={selectedConvIds.size === 0 || bulkActing}
            style={bulkActionBtnStyle(selectedConvIds.size === 0 || bulkActing)}
          >
            <BellOff size={17} strokeWidth={2.25} /> Mute
          </button>
          <button
            onClick={handleBulkHide}
            disabled={selectedConvIds.size === 0 || bulkActing}
            style={bulkActionBtnStyle(selectedConvIds.size === 0 || bulkActing)}
          >
            <EyeOff size={17} strokeWidth={2.25} /> Hide
          </button>
          <button
            onClick={() => setBulkConfirmAction('delete')}
            disabled={selectedConvIds.size === 0 || bulkActing}
            style={{ ...bulkActionBtnStyle(selectedConvIds.size === 0 || bulkActing), color: 'var(--error)', borderRight: 'none' }}
          >
            <Trash2 size={17} strokeWidth={2.25} /> Delete
          </button>
        </div>
      )}

      <NewConversationSheet isOpen={showNewConversation} onClose={() => setShowNewConversation(false)} />

      <ConversationActionSheet
        conversation={actionSheetConv}
        isMuted={actionSheetConv ? mutedIds.includes(actionSheetConv.conversation_id) : false}
        isOpen={!!actionSheetConv}
        onClose={() => setActionSheetConv(null)}
        onChanged={refreshConversations}
      />

      <ConversationContextMenu
        conversation={contextMenu?.conversation || null}
        isMuted={contextMenu ? mutedIds.includes(contextMenu.conversation.conversation_id) : false}
        position={contextMenu?.position || null}
        onClose={() => setContextMenu(null)}
        onChanged={refreshConversations}
      />

      <ConfirmSheet
        isOpen={bulkConfirmAction === 'delete'}
        onClose={() => setBulkConfirmAction(null)}
        title={`Delete ${selectedConvIds.size} conversation${selectedConvIds.size === 1 ? '' : 's'}?`}
        message="This clears them from your list and removes your message history for each. If they message you again, they'll reappear as fresh conversations."
        confirmLabel="Delete"
        confirmStyle="danger"
        onConfirm={handleBulkDelete}
      />

    </div>
  )
}

function bulkActionBtnStyle(disabled) {
  return {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '12px 8px',
    background: 'none',
    border: 'none',
    borderRight: '1px solid var(--border-light)',
    fontSize: '11.5px',
    fontWeight: '600',
    color: disabled ? 'var(--text-tertiary)' : 'var(--text)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    fontFamily: 'inherit',
  }
}
