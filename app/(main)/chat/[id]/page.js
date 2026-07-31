'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Avatar from '@/components/shared/Avatar'
import { getMessages, sendMessage, getConversation, markConversationRead, editMessage, deleteMessage, uploadMedia, getReactions, toggleReaction, getPinnedMessages, togglePin, searchMessages } from '@/actions/messages'
import { getGroupInfo } from '@/actions/groups'
import { createClient } from '@/lib/supabase/client'
import { cache } from '@/lib/cache'
import { useReadReceipts } from '@/hooks/useReadReceipts'
import { useOnlineUsers } from '@/lib/presence-context'
import MediaMessage from '@/components/chat/MediaMessage'
import AudioRecorder from '@/components/chat/MediaRecorder'
import CameraCapture from '@/components/chat/CameraCapture'
import MessageReactions from '@/components/chat/MessageReactions'
import ConversationSettingsSheet from '@/components/chat/ConversationSettingsSheet'
import MessageActionSheet from '@/components/chat/MessageActionSheet'
import MessageActionBar from '@/components/chat/MessageActionBar'
import ConfirmSheet from '@/components/shared/ConfirmSheet'

export default function ConversationPage() {
  const { id } = useParams()
  const router = useRouter()
  // Lazy-initialized straight from cache (not inside an effect) so the
  // very first render already has whatever's cached — an effect only
  // runs after that first paint has already happened, which is exactly
  // what was still causing the header/message-bubble flash even after
  // switching the effect's own cache reads to peek(): the state's
  // initial value was hardcoded regardless of what peek() would have
  // found. Same pattern already used by app/(main)/settings/page.js.
  const [messages, setMessages] = useState(() => {
    const cached = cache.peek(`messages:${id}`)
    return Array.isArray(cached) ? cached : []
  })
  const [conversation, setConversation] = useState(() => cache.peek(`conversation:${id}`))
  const [groupInfo, setGroupInfo] = useState(() => {
    const cachedConv = cache.peek(`conversation:${id}`)
    return cachedConv?.type === 'group' ? cache.peek(`group:${id}`) : null
  })
  // Also relied on for isOwn (message alignment/color) — starting this
  // at null unconditionally was why a message's own bubble could
  // briefly render as if it belonged to someone else.
  const [profile, setProfile] = useState(() => cache.peek('profile'))
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(() => !Array.isArray(cache.peek(`messages:${id}`)))
  const [sending, setSending] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [typingUsers, setTypingUsers] = useState([])
  const [mediaPreview, setMediaPreview] = useState(null)
  const [showRecorder, setShowRecorder] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [messageReactions, setMessageReactions] = useState({})
  const [showPinnedPanel, setShowPinnedPanel] = useState(false)
  const [pinnedMessages, setPinnedMessages] = useState([])
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [activeReactionPicker, setActiveReactionPicker] = useState(null)
  const [pinnedMessageIds, setPinnedMessageIds] = useState(new Set())
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionResults, setMentionResults] = useState([])
  const [showMentions, setShowMentions] = useState(false)
  const [mentionStartIndex, setMentionStartIndex] = useState(-1)
  const [showSettingsSheet, setShowSettingsSheet] = useState(false)
  const [actionSheetMsg, setActionSheetMsg] = useState(null)
  const [activeMessageDropdown, setActiveMessageDropdown] = useState(null)
  const [swipeMsgId, setSwipeMsgId] = useState(null)
  const [swipeDx, setSwipeDx] = useState(0)
  const longPressTimerRef = useRef(null)
  const longPressStartRef = useRef(null)
  const longPressFiredRef = useRef(false)
  const swipeTriggeredRef = useRef(false)
  const swipeActiveRef = useRef(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [newMessageCount, setNewMessageCount] = useState(0)
  const isAtBottomRef = useRef(true)
  const messagesContainerRef = useRef(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedMsgIds, setSelectedMsgIds] = useState(new Set())
  const { onlineUsers } = useOnlineUsers()
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const typingTimeout = useRef(null)
  const channelRef = useRef(null)
  const lastMessageIdRef = useRef(null)

  useReadReceipts(id, profile?.id, messages)

  useEffect(() => {
    async function load() {
      // Reset identity-bearing header state immediately, before reading
      // any cache. Without this, the previous conversation's name/avatar/
      // subtitle stays on screen for a render or two after the id changes
      // (they're only overwritten once the new conversation's own data
      // arrives) — showing another person's or group's identity briefly.
      // Blank is a much less jarring failure mode than wrong.
      setConversation(null)
      setGroupInfo(null)
      lastMessageIdRef.current = null

      // Show whatever's cached immediately — zero loading state for data
      // we've already seen, and never an empty/unknown header if a cached
      // copy exists at all. Uses peek() (ignores TTL) purely for this
      // instant paint, since a slightly stale header beats a blank one;
      // a separate TTL-respecting get() right below decides whether the
      // network round-trip can be skipped entirely or needs to run and
      // silently replace this with fresh data once it resolves.
      const peekedProfile = cache.peek('profile')
      const freshProfileCache = cache.get('profile')
      const peekedConv = cache.peek(`conversation:${id}`)
      const freshConvCache = cache.get(`conversation:${id}`)
      const cachedGroupInfo = peekedConv?.type === 'group' ? cache.peek(`group:${id}`) : null
      const cachedMessagesRaw = cache.peek(`messages:${id}`)
      const cachedMessages = Array.isArray(cachedMessagesRaw) ? cachedMessagesRaw : null

      if (peekedProfile) setProfile(peekedProfile)
      if (peekedConv) setConversation(peekedConv)
      if (cachedGroupInfo) setGroupInfo(cachedGroupInfo)
      if (cachedMessages) {
        setMessages(cachedMessages)
        setLoading(false)
      }

      const supabase = createClient()

      const profilePromise = freshProfileCache
        ? Promise.resolve(freshProfileCache)
        : (async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return null
            const { data } = await supabase
              .from('users')
              .select('id, username, display_name, avatar_url')
              .eq('id', user.id)
              .single()
            if (data) cache.set('profile', data, 300000)
            return data
          })()

      const convPromise = freshConvCache
        ? Promise.resolve(freshConvCache)
        : (async () => {
            const result = await getConversation(id)
            if (result.data) cache.set(`conversation:${id}`, result.data, 60000)
            return result.data
          })()

      const [freshProfile, freshConv, msgsResult] = await Promise.all([
        profilePromise,
        convPromise,
        getMessages(id),
      ])

      if (freshProfile) setProfile(freshProfile)

      if (freshConv) {
        setConversation(freshConv)
        if (freshConv.type === 'group') {
          const cachedGroup = cache.get(`group:${id}`)
          if (cachedGroup) {
            setGroupInfo(cachedGroup)
          } else {
            const groupResult = await getGroupInfo(id)
            if (groupResult.data) {
              setGroupInfo(groupResult.data)
              cache.set(`group:${id}`, groupResult.data, 60000)
            }
          }
        }
      }

      if (Array.isArray(msgsResult.data)) {
        setMessages(msgsResult.data)
        loadReactions(msgsResult.data)
        cache.set(`messages:${id}`, msgsResult.data, 20000)
      }
      setLoading(false)

      await markConversationRead(id)
      window.dispatchEvent(new Event('relay:conversation-read'))

      const pinnedResult = await getPinnedMessages(id)
      if (pinnedResult.data) {
        setPinnedMessages(pinnedResult.data)
        setPinnedMessageIds(new Set(pinnedResult.data.map(p => p.messages?.id)))
      }
    }
    load()
  }, [id])

  // Scroll to bottom when messages change — but only actually move the
  // scroll position when the last message genuinely changed. A single
  // conversation open sets `messages` two or three times in quick
  // succession (cache hit, then the fresh-fetch overwrite, sometimes with
  // the same content) — animating a smooth scroll on every one of those
  // is what read as bouncy/jarring. The first time a conversation's
  // messages appear, jump straight to the bottom instantly, like a native
  // messaging app; only genuinely new messages after that animate in.
  useEffect(() => {
    if (messages.length === 0) return
    const lastId = messages[messages.length - 1].id
    if (lastId === lastMessageIdRef.current) return
    const isInitial = lastMessageIdRef.current === null
    lastMessageIdRef.current = lastId

    // Only follow new messages to the bottom if the user is already
    // there (or this is the conversation's first paint) — someone
    // scrolled up reading history shouldn't get yanked back down.
    // Otherwise just count it toward the scroll-to-bottom button's badge.
    if (isInitial || isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: isInitial ? 'auto' : 'smooth' })
      setNewMessageCount(0)
    } else {
      setNewMessageCount(c => c + 1)
    }
  }, [messages])

  // Tracks scroll position within the messages list itself to show/hide
  // the floating scroll-to-bottom button and know whether new messages
  // should auto-scroll (above) or just increment its badge.
  useEffect(() => {
    const el = messagesContainerRef.current
    if (!el) return
    const handleScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      isAtBottomRef.current = distanceFromBottom < 50
      setShowScrollButton(distanceFromBottom > 200)
      if (distanceFromBottom < 50) setNewMessageCount(0)
    }
    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  const handleScrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
    setNewMessageCount(0)
  }

  // Supabase Realtime subscription
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`conversation:${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${id}`,
      }, async (payload) => {
        const newMsg = { ...payload.new, reply: null }
        if (payload.new.reply_to_id) {
          const { data: reply } = await supabase
            .from('messages')
            .select('id, content, sender_name_snapshot, type')
            .eq('id', payload.new.reply_to_id)
            .single()
          newMsg.reply = reply || null
        }
        if (['image', 'audio', 'file'].includes(payload.new.type)) {
          const { data: mediaRow } = await supabase
            .from('media')
            .select('url, filename, size, mime_type')
            .eq('message_id', payload.new.id)
            .single()
          if (mediaRow) {
            newMsg.media_url = mediaRow.url
            newMsg.media_filename = mediaRow.filename
            newMsg.media_size = mediaRow.size
            newMsg.media_mime_type = mediaRow.mime_type
          }
        }
        setMessages(prev => {
          const exists = prev.find(m => m.id === newMsg.id)
          if (exists) return prev
          return [...prev, newMsg]
        })
        cache.invalidate(`messages:${id}`)
        markConversationRead(id)
        window.dispatchEvent(new Event('relay:conversation-read'))
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${id}`,
      }, (payload) => {
        setMessages(prev => prev.map(m =>
          m.id === payload.new.id ? { ...m, ...payload.new } : m
        ))
        cache.invalidate(`messages:${id}`)
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.userId === profile?.id) return
        setTypingUsers(prev => {
          if (payload.payload.isTyping) {
            if (prev.find(u => u.userId === payload.payload.userId)) return prev
            return [...prev, payload.payload]
          } else {
            return prev.filter(u => u.userId !== payload.payload.userId)
          }
        })
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, profile?.id])

  const loadReactions = async (msgs) => {
    const reactionsMap = {}
    await Promise.all(
      msgs.map(async (msg) => {
        if (msg.type === 'text' || msg.type === 'image' || msg.type === 'audio' || msg.type === 'file') {
          const result = await getReactions(msg.id)
          if (result.data) reactionsMap[msg.id] = result.data
        }
      })
    )
    setMessageReactions(reactionsMap)
  }

  const handleTyping = async () => {
    if (!channelRef.current || !profile) return

    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: profile.id, displayName: profile.display_name, isTyping: true },
    })

    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: profile.id, displayName: profile.display_name, isTyping: false },
      })
    }, 2000)
  }

  const handleSend = async () => {
    if (!content.trim() || sending) return

    setSending(true)
    const text = content.trim()
    const pendingReply = replyTo
    setContent('')
    setReplyTo(null)

    // Stop typing indicator
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: profile?.id, displayName: profile?.display_name, isTyping: false },
    })

    const result = await sendMessage(id, text, pendingReply?.id || null)
    if (result.error) {
      setContent(text)
      // Restore the reply target too, not just the draft text — otherwise
      // a retry after a failed send silently posts as a plain message
      // instead of the reply the user actually composed.
      setReplyTo(pendingReply)
    } else {
      try { window.navigator.vibrate?.(10) } catch {}
    }
    setSending(false)
    inputRef.current?.focus()
  }

  const handleEdit = async (messageId) => {
    if (!editContent.trim()) return
    const result = await editMessage(messageId, editContent)
    if (!result.error) {
      setEditingId(null)
      setEditContent('')
    }
  }

  const handleDelete = (messageId) => {
    setConfirmDeleteId(messageId)
  }

  const confirmDeleteMessage = async () => {
    if (!confirmDeleteId) return
    await deleteMessage(confirmDeleteId)
    setConfirmDeleteId(null)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const otherParticipant = conversation?.participants?.[0]

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (timestamp) => {
    const msgDate = new Date(timestamp).toDateString()
    const today = new Date().toDateString()
    const yesterday = new Date(Date.now() - 86400000).toDateString()
    if (msgDate === today) return 'Today'
    if (msgDate === yesterday) return 'Yesterday'
    return new Date(timestamp).toLocaleDateString([], { month: 'long', day: 'numeric' })
  }

  const handleMediaUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    const isImage = imageTypes.includes(file.type)

    if (isImage) {
      const previewUrl = URL.createObjectURL(file)
      setMediaPreview({ file, previewUrl, isImage: true })
    } else {
      setMediaPreview({ file, isImage: false })
    }
    e.target.value = ''
  }

  const handleConfirmMediaUpload = async () => {
    if (!mediaPreview) return
    const formData = new FormData()
    formData.append('file', mediaPreview.file)
    if (replyTo?.id) formData.append('replyToId', replyTo.id)
    setSending(true)
    const result = await uploadMedia(id, formData)
    if (result.error) {
      alert(result.error)
    } else {
      setReplyTo(null)
    }
    if (mediaPreview.previewUrl) URL.revokeObjectURL(mediaPreview.previewUrl)
    setMediaPreview(null)
    setSending(false)
  }

  const handleRecordingComplete = async (file) => {
    setShowRecorder(false)
    const formData = new FormData()
    formData.append('file', file)
    if (replyTo?.id) formData.append('replyToId', replyTo.id)
    setSending(true)
    const result = await uploadMedia(id, formData)
    if (result.error) alert(result.error)
    else setReplyTo(null)
    setSending(false)
  }

  const handleCameraCapture = async (file) => {
    setShowCamera(false)
    const previewUrl = URL.createObjectURL(file)
    setMediaPreview({ file, previewUrl, isImage: true })
  }

  const handleSearch = async (query) => {
    setSearchQuery(query)
    if (query.length < 2) { setSearchResults([]); return }
    setSearching(true)
    const result = await searchMessages(id, query)
    if (result.data) setSearchResults(result.data)
    setSearching(false)
  }

  const handleLoadPinned = async () => {
    const result = await getPinnedMessages(id)
    if (result.data) setPinnedMessages(result.data)
    setPinnedMessageIds(new Set(result.data.map(p => p.messages?.id)))
    setShowPinnedPanel(true)
  }

  const reloadGroupInfo = async () => {
    const result = await getGroupInfo(id)
    if (result.data) {
      setGroupInfo(result.data)
      cache.set(`group:${id}`, result.data, 60000)
    }
  }

  const handleTogglePin = async (messageId) => {
    const result = await togglePin(id, messageId)
    if (result.error) alert(result.error)
    else if (showPinnedPanel) handleLoadPinned()
    setPinnedMessageIds(prev => {
      const next = new Set(prev)
      if (next.has(messageId)) next.delete(messageId)
      else next.add(messageId)
      return next
    })
  }

  const handleCopyMessage = async (msg) => {
    try { await navigator.clipboard.writeText(msg.content || '') } catch {}
  }

  const handleEnterSelectMode = (msg) => {
    setSelectMode(true)
    setSelectedMsgIds(new Set(msg ? [msg.id] : []))
  }

  const handleExitSelectMode = () => {
    setSelectMode(false)
    setSelectedMsgIds(new Set())
  }

  const handleToggleSelectMessage = (msgId) => {
    setSelectedMsgIds(prev => {
      const next = new Set(prev)
      if (next.has(msgId)) next.delete(msgId)
      else next.add(msgId)
      return next
    })
  }

  const selectedMessages = messages.filter(m => selectedMsgIds.has(m.id))
  const canBulkDelete = selectedMessages.length > 0 && selectedMessages.every(m => m.sender_id === profile?.id)

  const handleBulkDelete = async () => {
    if (!canBulkDelete) return
    await Promise.all(selectedMessages.map(m => deleteMessage(m.id)))
    handleExitSelectMode()
  }

  const handleBulkCopy = async () => {
    const text = selectedMessages
      .filter(m => m.type === 'text')
      .map(m => m.content)
      .join('\n')
    try { await navigator.clipboard.writeText(text) } catch {}
  }

  const handleQuickReact = async (messageId, emoji) => {
    const result = await toggleReaction(messageId, emoji)
    if (result.success) {
      try { window.navigator.vibrate?.(10) } catch {}
      const refreshed = await getReactions(messageId)
      if (refreshed.data) {
        setMessageReactions(prev => ({ ...prev, [messageId]: refreshed.data }))
      }
    }
  }

  // Long-press on a message bubble (mobile) opens MessageActionSheet —
  // same 400ms-hold / 10px-move-cancels pattern used for conversation
  // tiles in ChatList. Swiping right on the bubble instead (more
  // horizontal than vertical movement) previews a reply-arrow indicator
  // and, past a 40px threshold, sets the reply target — both gestures
  // share one set of touch handlers since they start the same way and
  // diverge based on how the touch actually moves.
  const handleMessageTouchStart = (msg) => (e) => {
    const touch = e.touches[0]
    if (!touch) return
    longPressFiredRef.current = false
    longPressStartRef.current = { x: touch.clientX, y: touch.clientY }
    swipeTriggeredRef.current = false
    swipeActiveRef.current = true
    setSwipeMsgId(msg.id)
    setSwipeDx(0)
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true
      try { window.navigator.vibrate?.(10) } catch {}
      setActionSheetMsg(msg)
    }, 400)
  }

  const handleMessageTouchMove = (msg) => (e) => {
    if (!longPressStartRef.current) return
    const touch = e.touches[0]
    if (!touch) return
    const dx = touch.clientX - longPressStartRef.current.x
    const dy = touch.clientY - longPressStartRef.current.y

    if (longPressTimerRef.current && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    if (dx > 0 && dx > Math.abs(dy)) {
      // This is a reply swipe, not a nav-back swipe — stop it here so
      // chat/layout.js's swipe-to-go-back handler (attached higher up
      // the tree, on the same touch sequence) never sees it.
      e.stopPropagation()
      setSwipeDx(Math.min(dx, 80))
      if (dx > 40 && !swipeTriggeredRef.current) {
        swipeTriggeredRef.current = true
        try { window.navigator.vibrate?.(10) } catch {}
        setReplyTo(msg)
      }
    }
  }

  const handleMessageTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    longPressStartRef.current = null
    swipeActiveRef.current = false
    setSwipeDx(0)
    // Keep swipeMsgId set through the snap-back transition, then clear
    // it so a later drag on a different message starts from a clean
    // state rather than racing this timeout.
    setTimeout(() => setSwipeMsgId(null), 300)
  }

  const handleMentionSelect = (member) => {
    const before = content.slice(0, mentionStartIndex)
    const after = content.slice(mentionStartIndex + mentionQuery.length + 1)
    const newContent = `${before}@${member.username} ${after}`
    setContent(newContent)
    setShowMentions(false)
    setMentionResults([])
    inputRef.current?.focus()
  }

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return ''
    const date = new Date(lastSeen)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = new Date(msg.created_at).toDateString()
    if (!groups[date]) groups[date] = []
    groups[date].push(msg)
    return groups
  }, {})

  if (loading) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}>
        <p style={{ color: '#A3A3A3', fontSize: '14px' }}>Loading...</p>
      </div>
    )
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: '#fff',
    }}>
      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onCancel={() => setShowCamera(false)}
        />
      )}

      {/* Header */}
      {selectMode ? (
        <div style={{
          padding: '12px 16px',
          borderBottom: '1.5px solid #E5E5E5',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: '#fff',
          flexShrink: 0,
        }}>
          <button
            onClick={handleExitSelectMode}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '44px',
              minHeight: '44px',
            }}
          >
            ✕
          </button>
          <p style={{ fontSize: '15px', fontWeight: '700', color: '#0a0a0a' }}>
            {selectedMsgIds.size} selected
          </p>
        </div>
      ) : (
      <div style={{
        padding: '12px 16px',
        borderBottom: '1.5px solid #E5E5E5',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: '#fff',
        flexShrink: 0,
      }}>
        <button
          onClick={() => router.push('/chat')}
          className="mobile-back-btn"
          style={{
            background: 'none',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '44px',
            minHeight: '44px',
          }}
        >
          ←
        </button>
        {conversation?.type === 'group' ? (
          <button
            onClick={() => router.push(`/groups/${id}/settings`)}
            style={{ background: 'none', border: 'none', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit' }}
          >
            <Avatar src={groupInfo?.avatar_url} name={groupInfo?.name} size={38} />
            <div>
              <p style={{ fontSize: '15px', fontWeight: '700', color: '#0a0a0a' }}>
                {groupInfo?.name}
              </p>
              <p style={{ fontSize: '12px', color: '#A3A3A3' }}>
                {groupInfo ? `${groupInfo.members?.length} members` : ''}
              </p>
            </div>
          </button>
        ) : otherParticipant ? (
          <button
            onClick={() => router.push(`/u/${otherParticipant.username}?from=conversation&convId=${id}`)}
            style={{ background: 'none', border: 'none', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit' }}
          >
            <Avatar src={otherParticipant.avatar_url} name={otherParticipant.display_name} size={38} />
            <div>
              <p style={{ fontSize: '15px', fontWeight: '700', color: '#0a0a0a' }}>
                {otherParticipant?.display_name}
              </p>
              <p style={{ fontSize: '12px', color: '#A3A3A3' }}>
                {onlineUsers.includes(otherParticipant?.id)
                  ? <span style={{ color: '#22C55E' }}>● Online</span>
                  : otherParticipant?.last_seen
                    ? `Last seen ${formatLastSeen(otherParticipant.last_seen)}`
                    : `@${otherParticipant?.username}`
                }
              </p>
            </div>
          </button>
        ) : null}
        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
          <button
            onClick={() => setShowSettingsSheet(true)}
            style={{
              width: '44px',
              height: '44px',
              background: '#fff',
              border: '1.5px solid #0a0a0a',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Conversation info"
          >
            ℹ️
          </button>
        </div>
      </div>
      )}

      {showPinnedPanel && (
        <div style={{
          borderBottom: '1.5px solid #0a0a0a',
          background: '#fff',
          flexShrink: 0,
          maxHeight: '250px',
          overflowY: 'auto',
        }}>
          <div style={{
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #F5F5F5',
            position: 'sticky',
            top: 0,
            background: '#fff',
          }}>
            <p style={{ fontSize: '14px', fontWeight: '700' }}>📌 Pinned messages</p>
            <button
              onClick={() => setShowPinnedPanel(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#A3A3A3' }}
            >×</button>
          </div>
          {pinnedMessages.length === 0 ? (
            <p style={{ padding: '16px', fontSize: '13px', color: '#A3A3A3' }}>No pinned messages</p>
          ) : pinnedMessages.map(pin => (
            <div
              key={pin.id}
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid #F5F5F5',
                cursor: 'pointer',
              }}
              onClick={() => {
                const el = document.getElementById(`msg-${pin.messages?.id}`)
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  el.style.background = '#FFF8E1'
                  setTimeout(() => el.style.background = '', 2000)
                }
                setShowPinnedPanel(false)
              }}
            >
              <p style={{ fontSize: '12px', fontWeight: '700', color: '#0a0a0a', marginBottom: '2px' }}>
                {pin.messages?.sender_name_snapshot}
              </p>
              <p style={{ fontSize: '13px', color: '#525252', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {pin.messages?.type === 'deleted' ? 'This message was deleted' : pin.messages?.content}
              </p>
              <p style={{ fontSize: '11px', color: '#A3A3A3', marginTop: '2px' }}>
                Pinned by {pin.users?.display_name}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="messages-scroll-area"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          overscrollBehaviorX: 'none',
          padding: '16px',
          paddingBottom: '32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        {Object.entries(groupedMessages).map(([date, msgs]) => (
          <div key={date}>
            {/* Date divider */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              margin: '16px 0 8px',
            }}>
              <div style={{ flex: 1, height: '1px', background: '#E5E5E5' }} />
              <span style={{ fontSize: '11px', color: '#A3A3A3', fontWeight: '600' }}>
                {formatDate(msgs[0].created_at)}
              </span>
              <div style={{ flex: 1, height: '1px', background: '#E5E5E5' }} />
            </div>

            {msgs.map((msg, i) => {
              const isOwn = msg.sender_id === profile?.id
              const isSystem = msg.type === 'system'
              const isDeleted = msg.type === 'deleted'
              const showAvatar = !isOwn && (i === 0 || msgs[i - 1]?.sender_id !== msg.sender_id)

              if (isSystem) {
                // display_name isn't unique (only username is), so a
                // substring match anywhere in the text could misattribute
                // another member's action to the viewer if they happen to
                // share a display name. Only ever substitutes at the very
                // start of the message — every system message template
                // names its subject (actor or target) first — which is
                // both narrower and unambiguous: it's a same-string
                // comparison against the viewer's own name, not a pattern
                // that could coincidentally match someone else's.
                const displayName = profile?.display_name
                const systemText = displayName && msg.content?.startsWith(`${displayName} `)
                  ? `You${msg.content.slice(displayName.length)}`
                    .replace('You is ', 'You are ')
                    .replace('You was ', 'You were ')
                  : msg.content

                return (
                  <div key={msg.id} style={{
                    textAlign: 'center',
                    padding: '8px 0',
                    fontSize: '12px',
                    color: '#A3A3A3',
                  }}>
                    {systemText}
                  </div>
                )
              }

              return (
                <div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '8px',
                    marginBottom: '2px',
                    marginTop: showAvatar ? '8px' : '0',
                  }}
                >
                  {selectMode && !isDeleted && (
                    <button
                      onClick={() => handleToggleSelectMessage(msg.id)}
                      aria-label="Select message"
                      style={{
                        flexShrink: 0,
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        border: `1.5px solid ${selectedMsgIds.has(msg.id) ? '#0a0a0a' : '#E5E5E5'}`,
                        background: selectedMsgIds.has(msg.id) ? '#0a0a0a' : '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0,
                        marginBottom: '4px',
                      }}
                    >
                      {selectedMsgIds.has(msg.id) && (
                        <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5 L4 7 L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  )}
                  <div
                    className="message-row"
                    onClick={selectMode && !isDeleted ? () => handleToggleSelectMessage(msg.id) : undefined}
                    style={{
                      display: 'flex',
                      flexDirection: isOwn ? 'row-reverse' : 'row',
                      alignItems: 'flex-end',
                      gap: '8px',
                      flex: 1,
                      minWidth: 0,
                      cursor: selectMode && !isDeleted ? 'pointer' : 'default',
                    }}
                  >
                  {/* Avatar for other user */}
                  {!isOwn && (
                    <div style={{ width: '28px', flexShrink: 0 }}>
                      {showAvatar && (
                        <Avatar
                          src={otherParticipant?.avatar_url}
                          name={msg.sender_name_snapshot}
                          size={28}
                        />
                      )}
                    </div>
                  )}

                  <div style={{
                    maxWidth: '70%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isOwn ? 'flex-end' : 'flex-start',
                  }}>
                    {/* Reply preview */}
                    {msg.reply && (
                      <div style={{
                        padding: '6px 10px',
                        background: '#F5F5F5',
                        borderRadius: '8px',
                        marginBottom: '4px',
                        borderLeft: '3px solid #FFB800',
                        fontSize: '12px',
                        color: '#525252',
                        maxWidth: '100%',
                      }}>
                        <p style={{ fontWeight: '700', marginBottom: '2px', fontSize: '11px' }}>
                          {msg.reply.sender_name_snapshot === profile?.display_name ? 'You' : msg.reply.sender_name_snapshot}
                        </p>
                        <p style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {msg.reply.type === 'deleted' ? 'Original message was deleted' : msg.reply.content}
                        </p>
                      </div>
                    )}

                    {/* Message bubble */}
                    {editingId === msg.id ? (
                      <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        <input
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleEdit(msg.id)
                            if (e.key === 'Escape') { setEditingId(null); setEditContent('') }
                          }}
                          maxLength={2000}
                          autoFocus
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            border: '1.5px solid #0a0a0a',
                            borderRadius: '8px',
                            fontSize: '16px',
                            fontFamily: 'inherit',
                            outline: 'none',
                          }}
                        />
                        <button
                          onClick={() => handleEdit(msg.id)}
                          style={{
                            padding: '8px 12px',
                            background: '#0a0a0a',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontFamily: 'inherit',
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setEditContent('') }}
                          style={{
                            padding: '8px 12px',
                            background: '#F5F5F5',
                            color: '#0a0a0a',
                            border: '1.5px solid #E5E5E5',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontFamily: 'inherit',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div
                        className="message-bubble"
                        style={{ position: 'relative' }}
                        onTouchStart={isDeleted || selectMode ? undefined : handleMessageTouchStart(msg)}
                        onTouchMove={isDeleted || selectMode ? undefined : handleMessageTouchMove(msg)}
                        onTouchEnd={isDeleted || selectMode ? undefined : handleMessageTouchEnd}
                        onContextMenu={e => {
                          if (isDeleted || selectMode) return
                          e.preventDefault()
                          setActiveMessageDropdown(msg.id)
                        }}
                      >
                        {!isDeleted && swipeMsgId === msg.id && swipeDx > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '-30px',
                            transform: 'translateY(-50%)',
                            opacity: Math.min(swipeDx / 40, 1),
                            fontSize: '18px',
                            pointerEvents: 'none',
                          }}>
                            ↩️
                          </div>
                        )}
                        <div style={{
                          transform: `translateX(${swipeMsgId === msg.id ? swipeDx : 0}px)`,
                          transition: (swipeActiveRef.current && swipeMsgId === msg.id) ? 'none' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        }}>
                          {(msg.type === 'image' || msg.type === 'audio' || msg.type === 'file') ? (
                            <MediaMessage message={msg} isOwn={isOwn} />
                          ) : (
                            <div
                              style={{
                                padding: isDeleted ? '8px 12px' : '10px 14px',
                                background: isDeleted ? '#F5F5F5' : isOwn ? '#0a0a0a' : '#F5F5F5',
                                color: isDeleted ? '#A3A3A3' : isOwn ? '#fff' : '#0a0a0a',
                                borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                                border: '1.5px solid #0a0a0a',
                                fontSize: '14px',
                                lineHeight: '1.5',
                                fontStyle: isDeleted ? 'italic' : 'normal',
                                wordBreak: 'break-word',
                              }}
                            >
                              {isDeleted ? 'This message was deleted' : msg.content}
                            </div>
                          )}
                        </div>

                        {!isDeleted && !selectMode && (
                          <div
                            className="message-action-bar-wrap"
                            style={{
                              position: 'absolute',
                              top: '-16px',
                              [isOwn ? 'left' : 'right']: 0,
                              zIndex: 5,
                            }}
                          >
                            <MessageActionBar
                              message={msg}
                              isOwn={isOwn}
                              isPinned={pinnedMessageIds.has(msg.id)}
                              dropdownOpen={activeMessageDropdown === msg.id}
                              onDropdownOpenChange={(open) => setActiveMessageDropdown(open ? msg.id : null)}
                              onReply={() => setReplyTo(msg)}
                              onEdit={() => { setEditingId(msg.id); setEditContent(msg.content) }}
                              onDelete={() => handleDelete(msg.id)}
                              onTogglePin={() => handleTogglePin(msg.id)}
                              onReact={(emoji) => handleQuickReact(msg.id, emoji)}
                              onCopy={() => handleCopyMessage(msg)}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Time and edited label */}
                    <div style={{
                      display: 'flex',
                      gap: '6px',
                      alignItems: 'center',
                      marginTop: '2px',
                    }}>
                      {msg.is_edited && (
                        <span style={{ fontSize: '10px', color: '#A3A3A3' }}>edited</span>
                      )}
                      <span style={{ fontSize: '10px', color: '#A3A3A3' }}>
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                    <MessageReactions
                      messageId={msg.id}
                      reactions={messageReactions[msg.id] || []}
                      currentUserId={profile?.id}
                      showPicker={activeReactionPicker === msg.id}
                      onTogglePicker={() => setActiveReactionPicker(prev => prev === msg.id ? null : msg.id)}
                      onReactionChange={async () => {
                        setActiveReactionPicker(null)
                        const result = await getReactions(msg.id)
                        if (result.data) {
                          setMessageReactions(prev => ({ ...prev, [msg.id]: result.data }))
                        }
                      }}
                    />
                  </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 0',
          }}>
            <div style={{
              padding: '8px 14px',
              background: '#F5F5F5',
              borderRadius: '4px 16px 16px 16px',
              border: '1.5px solid #E5E5E5',
              fontSize: '13px',
              color: '#A3A3A3',
              fontStyle: 'italic',
            }}>
              {typingUsers.length === 1
                ? `${typingUsers[0].displayName} is typing...`
                : 'Several people are typing...'}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {showScrollButton && (
        <button
          onClick={handleScrollToBottom}
          aria-label="Scroll to bottom"
          style={{
            position: 'fixed',
            right: '20px',
            bottom: '96px',
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: '#0a0a0a',
            border: 'none',
            color: '#fff',
            fontSize: '16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '2px 2px 0 #FFB800',
            zIndex: 20,
          }}
        >
          ↓
          {newMessageCount > 0 && (
            <div style={{
              position: 'absolute',
              top: '-6px',
              right: '-6px',
              minWidth: '18px',
              height: '18px',
              padding: '0 4px',
              background: '#FFB800',
              border: '1.5px solid #0a0a0a',
              borderRadius: '100px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: '800',
              color: '#0a0a0a',
            }}>
              {newMessageCount > 99 ? '99+' : newMessageCount}
            </div>
          )}
        </button>
      )}

      {/* Reply preview */}
      {replyTo && (
        <div style={{
          padding: '8px 16px',
          background: '#F5F5F5',
          borderTop: '1px solid #E5E5E5',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0,
        }}>
          <div style={{
            flex: 1,
            borderLeft: '3px solid #FFB800',
            paddingLeft: '10px',
          }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: '#0a0a0a', marginBottom: '2px' }}>
              Replying to {replyTo.sender_name_snapshot}
            </p>
            <p style={{
              fontSize: '12px',
              color: '#525252',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {replyTo.content}
            </p>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              color: '#A3A3A3',
              padding: '4px',
            }}
          >
            ×
          </button>
        </div>
      )}

      {showRecorder && (
        <AudioRecorder
          onRecordingComplete={handleRecordingComplete}
          onCancel={() => setShowRecorder(false)}
        />
      )}

      {mediaPreview && (
        <div style={{
          padding: '12px 16px',
          background: '#F5F5F5',
          borderTop: '1px solid #E5E5E5',
          flexShrink: 0,
        }}>
          <div style={{
            background: '#fff',
            border: '1.5px solid #0a0a0a',
            borderRadius: '12px',
            padding: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            {mediaPreview.isImage ? (
              <img
                src={mediaPreview.previewUrl}
                alt="Preview"
                style={{
                  width: '60px',
                  height: '60px',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  border: '1px solid #E5E5E5',
                }}
              />
            ) : (
              <div style={{
                width: '44px',
                height: '44px',
                background: '#F5F5F5',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                flexShrink: 0,
              }}>
                📄
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: '13px',
                fontWeight: '600',
                color: '#0a0a0a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginBottom: '2px',
              }}>
                {mediaPreview.file.name}
              </p>
              <p style={{ fontSize: '11px', color: '#A3A3A3' }}>
                {(mediaPreview.file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              onClick={handleConfirmMediaUpload}
              disabled={sending}
              style={{
                padding: '8px 16px',
                background: '#0a0a0a',
                color: '#fff',
                border: '1.5px solid #0a0a0a',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: '2px 2px 0 #FFB800',
                flexShrink: 0,
              }}
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
            <button
              onClick={() => {
                if (mediaPreview.previewUrl) URL.revokeObjectURL(mediaPreview.previewUrl)
                setMediaPreview(null)
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '20px',
                color: '#A3A3A3',
                padding: '4px',
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {showSearch && (
        <div style={{
          borderTop: '1px solid #E5E5E5',
          background: '#fff',
          flexShrink: 0,
          maxHeight: '300px',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #F5F5F5' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search messages..."
              autoFocus
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1.5px solid #0a0a0a',
                borderRadius: '8px',
                fontSize: '16px',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {searching && (
              <p style={{ padding: '12px 16px', fontSize: '13px', color: '#A3A3A3' }}>Searching...</p>
            )}
            {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
              <p style={{ padding: '12px 16px', fontSize: '13px', color: '#A3A3A3' }}>No messages found</p>
            )}
            {searchResults.map(msg => (
              <div
                key={msg.id}
                style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid #F5F5F5',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#F9F9F9'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                onClick={() => {
                  const el = document.getElementById(`msg-${msg.id}`)
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    el.style.background = '#FFF8E1'
                    setTimeout(() => el.style.background = '', 2000)
                  }
                  setShowSearch(false)
                }}
              >
                <p style={{ fontSize: '12px', fontWeight: '700', color: '#0a0a0a', marginBottom: '2px' }}>
                  {msg.sender_name_snapshot}
                </p>
                <p style={{ fontSize: '13px', color: '#525252', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {msg.content}
                </p>
                <p style={{ fontSize: '11px', color: '#A3A3A3', marginTop: '2px' }}>
                  {formatTime(msg.created_at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {showMentions && (
        <div style={{
          background: '#fff',
          border: '1.5px solid #0a0a0a',
          borderRadius: '12px',
          margin: '0 16px 8px',
          overflow: 'hidden',
          boxShadow: '3px 3px 0 #0a0a0a',
          flexShrink: 0,
        }}>
          {mentionResults.map(member => (
            <div
              key={member.user_id || member.id}
              onClick={() => handleMentionSelect(member)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                cursor: 'pointer',
                borderBottom: '1px solid #F5F5F5',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#F9F9F9'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              <Avatar src={member.avatar_url} name={member.display_name} size={32} userId={member.user_id || member.id} />
              <div>
                <p style={{ fontSize: '13px', fontWeight: '700', color: '#0a0a0a' }}>{member.display_name}</p>
                <p style={{ fontSize: '11px', color: '#A3A3A3' }}>@{member.username}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      {selectMode ? (
        <div style={{
          position: 'sticky',
          bottom: 0,
          padding: '12px 16px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
          borderTop: '1.5px solid #E5E5E5',
          display: 'flex',
          gap: '10px',
          background: '#fff',
          flexShrink: 0,
        }}>
          <button
            onClick={handleBulkDelete}
            disabled={!canBulkDelete}
            style={{
              flex: 1,
              padding: '12px',
              background: 'none',
              border: 'none',
              color: canBulkDelete ? '#EF4444' : '#E5E5E5',
              fontSize: '14px',
              fontWeight: '700',
              cursor: canBulkDelete ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
            }}
          >
            🗑️ Delete
          </button>
          <button
            disabled
            title="Coming soon"
            style={{
              flex: 1,
              padding: '12px',
              background: 'none',
              border: 'none',
              color: '#E5E5E5',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'not-allowed',
              fontFamily: 'inherit',
            }}
          >
            ➡️ Forward
          </button>
          <button
            onClick={handleBulkCopy}
            disabled={selectedMsgIds.size === 0}
            style={{
              flex: 1,
              padding: '12px',
              background: 'none',
              border: 'none',
              color: selectedMsgIds.size > 0 ? '#0a0a0a' : '#E5E5E5',
              fontSize: '14px',
              fontWeight: '700',
              cursor: selectedMsgIds.size > 0 ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
            }}
          >
            📋 Copy all
          </button>
        </div>
      ) : (
      <div className="chat-input-bar" style={{
        position: 'sticky',
        bottom: 0,
        padding: '12px 16px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
        borderTop: '1.5px solid #E5E5E5',
        background: '#fff',
        flexShrink: 0,
      }}>
        {content.length >= 1600 && (
          <p style={{
            fontSize: '11px',
            color: content.length >= 2000 ? '#EF4444' : '#A3A3A3',
            textAlign: 'right',
            marginBottom: '4px',
          }}>
            {content.length}/2000
          </p>
        )}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <input
            type="file"
            id="media-upload"
            accept="image/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
            onChange={handleMediaUpload}
            style={{ display: 'none' }}
          />
          <label
            htmlFor="media-upload"
            style={{
              width: '44px',
              height: '44px',
              background: '#fff',
              border: '1.5px solid #0a0a0a',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '18px',
              flexShrink: 0,
            }}
            title="Attach file"
          >
            📎
          </label>
          <button
            onClick={() => setShowCamera(true)}
            style={{
              width: '44px',
              height: '44px',
              background: '#fff',
              border: '1.5px solid #0a0a0a',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '18px',
              flexShrink: 0,
            }}
            title="Camera"
          >
            📷
          </button>
          <button
            onClick={() => setShowRecorder(true)}
            style={{
              width: '44px',
              height: '44px',
              background: '#fff',
              border: '1.5px solid #0a0a0a',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '18px',
              flexShrink: 0,
            }}
            title="Voice message"
          >
            🎙️
          </button>
        </div>
        <textarea
          ref={inputRef}
          value={content}
          onChange={e => {
            const val = e.target.value
            setContent(val)
            handleTyping()

            const cursorPos = e.target.selectionStart
            const textBeforeCursor = val.slice(0, cursorPos)
            const atMatch = textBeforeCursor.match(/@(\w*)$/)

            if (atMatch && groupInfo) {
              const query = atMatch[1].toLowerCase()
              setMentionQuery(query)
              setMentionStartIndex(cursorPos - atMatch[0].length)
              const filtered = groupInfo.members?.filter(m =>
                (m.user_id !== profile?.id) &&
                (m.username?.toLowerCase().includes(query) ||
                m.display_name?.toLowerCase().includes(query))
              ) || []
              setMentionResults(filtered)
              setShowMentions(filtered.length > 0)
            } else {
              setShowMentions(false)
              setMentionResults([])
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          rows={1}
          maxLength={2000}
          style={{
            flex: 1,
            padding: '10px 14px',
            border: '1.5px solid #E5E5E5',
            borderRadius: '12px',
            fontSize: '16px',
            fontFamily: 'inherit',
            outline: 'none',
            resize: 'none',
            lineHeight: '1.5',
            maxHeight: '120px',
            overflowY: 'auto',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => e.target.style.borderColor = '#0a0a0a'}
          onBlur={e => e.target.style.borderColor = '#E5E5E5'}
          onInput={e => {
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
          }}
        />
        <button
          onClick={handleSend}
          disabled={!content.trim() || sending}
          style={{
            width: '44px',
            height: '44px',
            background: content.trim() ? '#0a0a0a' : '#E5E5E5',
            border: '1.5px solid #0a0a0a',
            borderRadius: '10px',
            cursor: content.trim() ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            flexShrink: 0,
            transition: 'background 0.15s',
            boxShadow: content.trim() ? '2px 2px 0 #FFB800' : 'none',
          }}
        >
          →
        </button>
        </div>
      </div>
      )}

      <style>{`
        .mobile-back-btn { display: flex; }
        @media (min-width: 769px) {
          .mobile-back-btn { display: none; }
        }
        /* Desktop hover action bar: invisible until the message row is
           hovered, pure CSS so hovering doesn't trigger a React re-render
           per message. Hidden entirely on mobile, which uses long-press
           (MessageActionSheet) instead. */
        .message-action-bar-wrap {
          opacity: 0;
          transition: opacity 0.12s;
          pointer-events: none;
        }
        .message-row:hover .message-action-bar-wrap {
          opacity: 1;
          pointer-events: auto;
        }
        @media (max-width: 768px) {
          .message-action-bar-wrap {
            display: none;
          }
        }
      `}</style>

      <ConversationSettingsSheet
        isOpen={showSettingsSheet}
        onClose={() => setShowSettingsSheet(false)}
        conversationId={id}
        isGroup={conversation?.type === 'group'}
        myRole={conversation?.role}
        otherParticipant={otherParticipant}
        isOnline={onlineUsers.includes(otherParticipant?.id)}
        groupInfo={groupInfo}
        pinnedCount={pinnedMessages.length}
        onOpenSearch={() => setShowSearch(true)}
        onOpenPinned={handleLoadPinned}
        onGroupChanged={reloadGroupInfo}
        onSelectMessages={() => handleEnterSelectMode(null)}
      />

      <MessageActionSheet
        message={actionSheetMsg}
        isOpen={!!actionSheetMsg}
        onClose={() => setActionSheetMsg(null)}
        isOwn={actionSheetMsg?.sender_id === profile?.id}
        isPinned={actionSheetMsg ? pinnedMessageIds.has(actionSheetMsg.id) : false}
        onReply={() => setReplyTo(actionSheetMsg)}
        onEdit={() => { setEditingId(actionSheetMsg.id); setEditContent(actionSheetMsg.content) }}
        onDelete={() => handleDelete(actionSheetMsg.id)}
        onTogglePin={() => handleTogglePin(actionSheetMsg.id)}
        onReact={(emoji) => handleQuickReact(actionSheetMsg.id, emoji)}
        onCopy={() => handleCopyMessage(actionSheetMsg)}
        onSelect={() => handleEnterSelectMode(actionSheetMsg)}
      />

      <ConfirmSheet
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        title="Delete message?"
        message="This deletes the message for everyone in the conversation. This cannot be undone."
        confirmLabel="Delete"
        confirmStyle="danger"
        onConfirm={confirmDeleteMessage}
      />
    </div>
  )
}
