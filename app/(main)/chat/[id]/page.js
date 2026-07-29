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

export default function ConversationPage() {
  const { id } = useParams()
  const router = useRouter()
  const [messages, setMessages] = useState([])
  const [conversation, setConversation] = useState(null)
  const [groupInfo, setGroupInfo] = useState(null)
  const [profile, setProfile] = useState(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [editingId, setEditingId] = useState(null)
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
  const longPressTimerRef = useRef(null)
  const longPressStartRef = useRef(null)
  const longPressFiredRef = useRef(false)
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
      // we've already seen. Fresh data still gets fetched below and swaps
      // in silently as it arrives. Messages use peek() rather than get()
      // since we always re-fetch them fresh below regardless of TTL — the
      // TTL shouldn't also gate whether we get to show something instantly.
      const cachedProfile = cache.get('profile')
      const cachedConv = cache.get(`conversation:${id}`)
      const cachedGroupInfo = cachedConv?.type === 'group' ? cache.get(`group:${id}`) : null
      const cachedMessagesRaw = cache.peek(`messages:${id}`)
      const cachedMessages = Array.isArray(cachedMessagesRaw) ? cachedMessagesRaw : null

      if (cachedProfile) setProfile(cachedProfile)
      if (cachedConv) setConversation(cachedConv)
      if (cachedGroupInfo) setGroupInfo(cachedGroupInfo)
      if (cachedMessages) {
        setMessages(cachedMessages)
        setLoading(false)
      }

      const supabase = createClient()

      const profilePromise = cachedProfile
        ? Promise.resolve(cachedProfile)
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

      const convPromise = cachedConv
        ? Promise.resolve(cachedConv)
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
    const behavior = lastMessageIdRef.current === null ? 'auto' : 'smooth'
    lastMessageIdRef.current = lastId
    messagesEndRef.current?.scrollIntoView({ behavior })
  }, [messages])

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
    setContent('')
    setReplyTo(null)

    // Stop typing indicator
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: profile?.id, displayName: profile?.display_name, isTyping: false },
    })

    const result = await sendMessage(id, text, replyTo?.id || null)
    if (result.error) {
      setContent(text)
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

  const handleDelete = async (messageId) => {
    if (!confirm('Delete this message for everyone?')) return
    await deleteMessage(messageId)
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
  // tiles in ChatList.
  const handleMessageTouchStart = (msg) => (e) => {
    const touch = e.touches[0]
    if (!touch) return
    longPressFiredRef.current = false
    longPressStartRef.current = { x: touch.clientX, y: touch.clientY }
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true
      try { window.navigator.vibrate?.(10) } catch {}
      setActionSheetMsg(msg)
    }, 400)
  }

  const handleMessageTouchMove = (e) => {
    if (!longPressStartRef.current || !longPressTimerRef.current) return
    const touch = e.touches[0]
    if (!touch) return
    const dx = Math.abs(touch.clientX - longPressStartRef.current.x)
    const dy = Math.abs(touch.clientY - longPressStartRef.current.y)
    if (dx > 10 || dy > 10) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleMessageTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
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
            onClick={() => setShowSettingsSheet(true)}
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
            onClick={() => setShowSettingsSheet(true)}
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
      <div className="messages-scroll-area" style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        overscrollBehaviorX: 'none',
        padding: '16px',
        paddingBottom: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}>
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
                const escapedName = profile?.display_name?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') || ''
                const systemText = escapedName ? msg.content
                  ?.replace(new RegExp(`^${escapedName} `), 'You ')
                  ?.replace(new RegExp(` ${escapedName} is `), ' you are ')
                  ?.replace(new RegExp(` ${escapedName}$`), ' you')
                  ?.replace(new RegExp(` ${escapedName} `), ' you ')
                  ?.replace('You is ', 'You are ')
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
                  className="message-row"
                  style={{
                    display: 'flex',
                    flexDirection: isOwn ? 'row-reverse' : 'row',
                    alignItems: 'flex-end',
                    gap: '8px',
                    marginBottom: '2px',
                    marginTop: showAvatar ? '8px' : '0',
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
                        style={{ position: 'relative' }}
                        onTouchStart={isDeleted ? undefined : handleMessageTouchStart(msg)}
                        onTouchMove={isDeleted ? undefined : handleMessageTouchMove}
                        onTouchEnd={isDeleted ? undefined : handleMessageTouchEnd}
                        onContextMenu={e => {
                          if (isDeleted) return
                          e.preventDefault()
                          setActiveMessageDropdown(msg.id)
                        }}
                      >
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

                        {!isDeleted && (
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
      <div className="chat-input-bar" style={{
        position: 'sticky',
        bottom: 0,
        padding: '12px 16px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
        borderTop: '1.5px solid #E5E5E5',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-end',
        background: '#fff',
        flexShrink: 0,
      }}>
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
      />
    </div>
  )
}
