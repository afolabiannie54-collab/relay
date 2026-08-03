'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ChevronLeft, Pin, X, ArrowDown, Paperclip, Camera, Mic, Send,
  Trash2, Forward, Copy, FileText, Reply, Image as ImageIcon,
} from 'lucide-react'
import Avatar from '@/components/shared/Avatar'
import EllipsisDoodle from '@/components/shared/icons/EllipsisDoodle'
import { getMessages, sendMessage, getConversation, markConversationRead, editMessage, deleteMessage, uploadMedia, getReactions, toggleReaction, getPinnedMessages, togglePin, searchMessages, acceptMessageRequest } from '@/actions/messages'
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
import { useProfileSheet } from '@/lib/profile-sheet-context'

// Matches the nav/ChatList icon convention — square caps/miter joins
// instead of lucide's default rounded ones.
const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

// A reply quoting a media message previously showed that message's raw
// `content` — for images/files that's often empty or a caption, but for
// a voice note it's the literal generated filename ("voice-<timestamp>.
// webm"), which read as a technical glitch rather than a reply preview.
// Same {icon, text} shape as ChatList's own getLastMessagePreview, kept
// separate since this one also needs the "Original message was deleted"
// case ChatList's list-row preview never has to handle.
function getReplyPreview(reply) {
  if (!reply) return { icon: null, text: '' }
  if (reply.type === 'deleted') return { icon: null, text: 'Original message was deleted' }
  if (reply.type === 'image') return { icon: ImageIcon, text: 'Photo' }
  if (reply.type === 'audio') return { icon: Mic, text: 'Voice message' }
  if (reply.type === 'file') return { icon: Paperclip, text: 'File' }
  return { icon: null, text: reply.content }
}

export default function ConversationPage() {
  const { id } = useParams()
  const router = useRouter()
  const { openProfile } = useProfileSheet()
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
  const [errorMsg, setErrorMsg] = useState(null)
  const errorTimeoutRef = useRef(null)
  const [acceptingRequest, setAcceptingRequest] = useState(false)
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
  const [swipeActive, setSwipeActive] = useState(false)
  const longPressTimerRef = useRef(null)
  const longPressStartRef = useRef(null)
  const longPressFiredRef = useRef(false)
  const swipeTriggeredRef = useRef(false)
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
  const wasDisconnectedRef = useRef(false)
  const lastMessageIdRef = useRef(null)
  // message_reactions has no conversation_id column to filter Realtime
  // on, so the reactions listener below has to check each incoming
  // change against the currently loaded messages itself — this ref
  // keeps that check reading live data instead of whatever `messages`
  // was when the channel effect last ran (it isn't in that effect's
  // dependency array, since resubscribing the channel on every new
  // message would be wasteful).
  const messagesRef = useRef(messages)

  // A backgrounded/minimized tab shouldn't silently mark messages as
  // read just because they arrived while it happened to be open — only
  // actually marks read (and tells the chat list to clear the tile
  // badge) while the tab is genuinely visible. The visibilitychange
  // listener below catches up once it's foregrounded again, whether
  // that's from a message that arrived while backgrounded or just
  // reopening a tab that was left on this conversation.
  const markReadIfVisible = useCallback(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    markConversationRead(id)
    window.dispatchEvent(new CustomEvent('relay:conversation-read', { detail: { conversationId: id } }))
  }, [id])

  useEffect(() => {
    const handleVisibility = () => { if (document.visibilityState === 'visible') markReadIfVisible() }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [markReadIfVisible])

  useReadReceipts(id, profile?.id, messages)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

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

      // Group info is folded into this same promise (rather than fetched
      // in a second `await` after setConversation below) so the two ever
      // land in the same render. A gap between them meant React committed
      // an intermediate render with the conversation set but groupInfo
      // still null — Avatar got an undefined src/name for that one frame
      // and flashed its "?" placeholder before the real avatar arrived.
      const convPromise = (async () => {
        const convData = freshConvCache || (await getConversation(id)).data
        if (!convData) return { conversation: null, groupInfo: null }
        if (!freshConvCache) cache.set(`conversation:${id}`, convData, 60000)

        let groupInfo = null
        if (convData.type === 'group') {
          groupInfo = cache.get(`group:${id}`)
          if (!groupInfo) {
            const groupResult = await getGroupInfo(id)
            if (groupResult.data) {
              groupInfo = groupResult.data
              cache.set(`group:${id}`, groupInfo, 60000)
            }
          }
        }
        return { conversation: convData, groupInfo }
      })()

      const [freshProfile, convResult, msgsResult] = await Promise.all([
        profilePromise,
        convPromise,
        getMessages(id),
      ])

      if (freshProfile) setProfile(freshProfile)

      if (convResult.conversation) {
        setConversation(convResult.conversation)
        if (convResult.groupInfo) setGroupInfo(convResult.groupInfo)
      }

      if (Array.isArray(msgsResult.data)) {
        setMessages(msgsResult.data)
        loadReactions(msgsResult.data)
        cache.set(`messages:${id}`, msgsResult.data, 20000)
      }
      setLoading(false)

      markReadIfVisible()

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
    wasDisconnectedRef.current = false

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
        markReadIfVisible()
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
      .subscribe((status) => {
        // A dropped connection (network blip, laptop sleep, Supabase
        // realtime hiccup) used to leave this conversation silently
        // stale forever — nothing here ever noticed the channel came
        // back, so anything sent/edited while disconnected only showed
        // up once you manually left and reopened the conversation. Once
        // we've seen a real disconnect (TIMED_OUT/CHANNEL_ERROR/CLOSED),
        // the next SUBSCRIBED is a reconnect, not the initial one, so
        // refetch messages to catch up on whatever was missed.
        if (status === 'SUBSCRIBED') {
          if (wasDisconnectedRef.current) {
            wasDisconnectedRef.current = false
            getMessages(id).then(result => {
              if (Array.isArray(result.data)) {
                setMessages(result.data)
                cache.set(`messages:${id}`, result.data, 20000)
              }
            })
          }
        } else if (['TIMED_OUT', 'CHANNEL_ERROR', 'CLOSED'].includes(status)) {
          wasDisconnectedRef.current = true
        }
      })

    // Everything that isn't message delivery lives on a SECOND channel,
    // deliberately. Realtime validates every postgres_changes binding
    // when a channel subscribes, and one invalid binding fails the whole
    // channel — which is exactly how a stale pinned_messages binding
    // (the table had never been added to the supabase_realtime
    // publication) silently took new-message delivery down with it while
    // push notifications, a separate server-side path, kept working.
    // Splitting them means an auxiliary listener can never again be the
    // reason messages stop arriving; worst case a reaction or member
    // badge lags until reload.
    const auxChannel = supabase
      .channel(`conversation-aux:${id}`)
      // Member/role changes (add, remove, promote, demote, transfer
      // ownership) for THIS open conversation. Unlike the group-deletion
      // case, these are inserts/updates on rows that still exist
      // afterward, so there's no "RLS re-queries an already-emptied
      // table" problem blocking delivery — this should reach other
      // participants live. Without it, only the person who took the
      // action saw groupInfo (member list, role badges) update; everyone
      // else needed a manual reload.
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversation_participants',
        filter: `conversation_id=eq.${id}`,
      }, () => {
        reloadGroupInfo()
      })
      // Clears the sender's "waiting for acceptance" composer state the
      // moment the receiver actually accepts, instead of leaving it
      // stuck until the sender manually reloads the conversation.
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'message_requests',
        filter: `conversation_id=eq.${id}`,
      }, (payload) => {
        if (payload.new.status !== 'pending') {
          setConversation(prev => prev ? { ...prev, pendingRequestAsSender: false, pendingRequestAsReceiver: false } : prev)
        }
      })
      // message_reactions has no conversation_id column, so this can't
      // be filtered server-side the way the others above are — it's
      // scoped to this conversation by checking the changed row's
      // message_id against messagesRef instead (see that ref's comment).
      // Without this, only the person who added/removed a reaction saw
      // it; anyone else already viewing the conversation needed to
      // reopen it to see reactions someone else made.
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_reactions',
      }, async (payload) => {
        const messageId = payload.new?.message_id || payload.old?.message_id
        if (!messageId) return
        if (!messagesRef.current.some(m => m.id === messageId)) return
        const result = await getReactions(messageId)
        if (result.data) {
          setMessageReactions(prev => ({ ...prev, [messageId]: result.data }))
        }
      })
      // Pin/unpin for this conversation — keeps both the pinned panel
      // (if open) and pinnedCount (shown in ConversationSettingsSheet)
      // in sync for everyone, not just whoever toggled the pin.
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pinned_messages',
        filter: `conversation_id=eq.${id}`,
      }, async () => {
        const result = await getPinnedMessages(id)
        if (result.data) {
          setPinnedMessages(result.data)
          setPinnedMessageIds(new Set(result.data.map(p => p.messages?.id)))
        }
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(auxChannel)
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

  // Inline replacement for alert() — blocking browser dialogs looked
  // unprofessional and don't fit the app's own design language. Shown as
  // a small banner above the composer and auto-clears so it doesn't
  // linger indefinitely; a new error resets the clear timer instead of
  // being cut short by an earlier one still pending.
  const showError = (msg) => {
    setErrorMsg(msg)
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current)
    errorTimeoutRef.current = setTimeout(() => setErrorMsg(null), 4000)
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

    try {
      const result = await sendMessage(id, text, pendingReply?.id || null)
      if (result.error) {
        setContent(text)
        // Restore the reply target too, not just the draft text — otherwise
        // a retry after a failed send silently posts as a plain message
        // instead of the reply the user actually composed.
        setReplyTo(pendingReply)
        // This used to fail completely silently — the draft just bounced
        // back into the input with no explanation, which is exactly how a
        // still-pending message request (blocked server-side in
        // sendMessage) would present: looks like nothing happened at all.
        showError(result.error)
      } else {
        try { window.navigator.vibrate?.(10) } catch {}
      }
    } catch (err) {
      setContent(text)
      setReplyTo(pendingReply)
      showError('Failed to send — please try again.')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleAcceptRequest = async () => {
    if (!conversation?.pendingRequestId) return
    setAcceptingRequest(true)
    const result = await acceptMessageRequest(conversation.pendingRequestId)
    if (result.error) {
      showError(result.error)
      setAcceptingRequest(false)
      return
    }
    setConversation(prev => prev ? { ...prev, pendingRequestAsReceiver: false, pendingRequestId: null } : prev)
    setAcceptingRequest(false)
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
    try {
      const result = await uploadMedia(id, formData)
      if (result.error) {
        showError(result.error)
      } else {
        setReplyTo(null)
      }
    } catch (err) {
      // A rejected/thrown call here (a request-size limit, a dropped
      // connection mid-upload) used to skip straight past the cleanup
      // below, leaving the preview stuck on "Sending..." forever with
      // no error and no way out except discarding the attachment.
      showError('Failed to send — please try again.')
    } finally {
      if (mediaPreview.previewUrl) URL.revokeObjectURL(mediaPreview.previewUrl)
      setMediaPreview(null)
      setSending(false)
    }
  }

  const handleRecordingComplete = async (file) => {
    setShowRecorder(false)
    const formData = new FormData()
    formData.append('file', file)
    if (replyTo?.id) formData.append('replyToId', replyTo.id)
    setSending(true)
    try {
      const result = await uploadMedia(id, formData)
      if (result.error) showError(result.error)
      else setReplyTo(null)
    } catch (err) {
      showError('Failed to send — please try again.')
    } finally {
      setSending(false)
    }
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
    if (result.error) showError(result.error)
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
    setSwipeActive(true)
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
    setSwipeActive(false)
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
      background: 'var(--surface)',
    }}>
      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onCancel={() => setShowCamera(false)}
        />
      )}

      {/* Header */}
      {selectMode ? (
        <div className="relay-fade-in" style={{
          padding: '12px 16px',
          borderBottom: '2px solid var(--border-strong)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'var(--surface)',
          flexShrink: 0,
        }}>
          <button
            onClick={handleExitSelectMode}
            aria-label="Exit select mode"
            className="relay-plain-icon-btn"
          >
            <X size={24} {...iconProps} />
          </button>
          <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)' }}>
            {selectedMsgIds.size} selected
          </p>
        </div>
      ) : (
      <div style={{
        padding: '12px 16px',
        borderBottom: '2px solid var(--border-strong)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'var(--surface)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => router.push('/chat')}
          aria-label="Back"
          className="mobile-back-btn relay-plain-icon-btn"
        >
          <ChevronLeft size={26} {...iconProps} />
        </button>
        {/* Desktop equivalent — the list stays visible on desktop so this
            isn't "back" in the navigation-stack sense, but there was
            previously no way at all to deselect a conversation and return
            to the empty state once one was open. */}
        <button
          onClick={() => router.push('/chat')}
          aria-label="Close conversation"
          className="desktop-close-btn relay-plain-icon-btn"
          title="Close conversation"
        >
          <ChevronLeft size={26} {...iconProps} />
        </button>
        {conversation?.type === 'group' ? (
          <button
            onClick={() => setShowSettingsSheet(true)}
            style={{ background: 'none', border: 'none', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit' }}
          >
            <Avatar src={groupInfo?.avatar_url} name={groupInfo?.name} size={38} />
            <div>
              <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)' }}>
                {groupInfo?.name}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                {groupInfo ? `${groupInfo.members?.length} members` : ''}
              </p>
            </div>
          </button>
        ) : otherParticipant ? (
          <button
            onClick={() => openProfile(otherParticipant.username)}
            style={{ background: 'none', border: 'none', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit' }}
          >
            <Avatar src={otherParticipant.avatar_url} name={otherParticipant.display_name} size={38} />
            <div>
              <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)' }}>
                {otherParticipant?.display_name}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                {onlineUsers.includes(otherParticipant?.id) && otherParticipant?.show_online_status
                  ? <span style={{ color: 'var(--success)' }}>● Online</span>
                  : otherParticipant?.show_last_seen
                    // @username only as a placeholder when last-seen is
                    // permitted but there's simply no data yet — never
                    // shown as a fallback once show_last_seen is off;
                    // the whole line just isn't there then, same as
                    // ConversationSettingsSheet.
                    ? (otherParticipant?.last_seen ? `Last seen ${formatLastSeen(otherParticipant.last_seen)}` : `@${otherParticipant?.username}`)
                    : null
                }
              </p>
            </div>
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
            <div className="relay-skeleton" style={{ width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0 }} />
            <div className="relay-skeleton" style={{ width: '120px', height: '14px' }} />
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
          <button
            onClick={() => setShowSettingsSheet(true)}
            aria-label="Conversation info"
            className="relay-plain-icon-btn"
            title="Conversation info"
          >
            <EllipsisDoodle size={24} />
          </button>
        </div>
      </div>
      )}

      {showPinnedPanel && (
        <div className="relay-fade-in" style={{
          borderBottom: '2px solid var(--border-strong)',
          background: 'var(--surface)',
          flexShrink: 0,
          maxHeight: '250px',
          overflowY: 'auto',
        }}>
          <div style={{
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-light)',
            position: 'sticky',
            top: 0,
            background: 'var(--surface)',
          }}>
            <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Pin size={14} {...iconProps} /> Pinned messages
            </p>
            <button
              onClick={() => setShowPinnedPanel(false)}
              aria-label="Close"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: '4px' }}
            ><X size={16} {...iconProps} /></button>
          </div>
          {pinnedMessages.length === 0 ? (
            <p style={{ padding: '16px', fontSize: '13px', color: 'var(--text-tertiary)' }}>No pinned messages</p>
          ) : pinnedMessages.map(pin => (
            <div
              key={pin.id}
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid var(--border-light)',
                cursor: 'pointer',
              }}
              onClick={() => {
                const el = document.getElementById(`msg-${pin.messages?.id}`)
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  el.style.background = 'var(--accent-light)'
                  setTimeout(() => el.style.background = '', 2000)
                }
                setShowPinnedPanel(false)
              }}
            >
              <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text)', marginBottom: '2px' }}>
                {pin.messages?.sender_name_snapshot}
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {pin.messages?.type === 'deleted' ? 'This message was deleted' : pin.messages?.content}
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                Pinned by {pin.users?.display_name}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Messages — a faint tiled doodle pattern behind the bubbles, same
          idea as WhatsApp's default chat wallpaper: barely-there texture
          rather than a flat surface, without competing with the bubbles
          themselves for attention. */}
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
          backgroundColor: 'var(--bg-subtle)',
          backgroundImage: 'url(/patterns/chat-bg.svg)',
          backgroundRepeat: 'repeat',
        }}
      >
        {Object.entries(groupedMessages).map(([date, msgs]) => (
          <div key={date}>
            {/* Date divider — a solid pill rather than plain text, so it
                stays legible sitting on the tiled background pattern. */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              margin: '16px 0 8px',
            }}>
              <span style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                fontWeight: '700',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-pill)',
                padding: '4px 12px',
              }}>
                {formatDate(msgs[0].created_at)}
              </span>
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
                  <div key={msg.id} style={{ display: 'flex', justifyContent: 'center', padding: '6px 0' }}>
                    <span style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-pill)',
                      padding: '4px 12px',
                    }}>
                      {systemText}
                    </span>
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
                        border: selectedMsgIds.has(msg.id) ? 'none' : '1.5px solid var(--border-strong)',
                        background: selectedMsgIds.has(msg.id) ? 'var(--accent)' : 'var(--surface)',
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
                          <path d="M2 5 L4 7 L8 3" stroke="var(--foreground)" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter"/>
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
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        marginBottom: '4px',
                        borderLeft: '3px solid var(--accent)',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        maxWidth: '100%',
                      }}>
                        <p style={{ fontWeight: '700', marginBottom: '2px', fontSize: '11px', color: 'var(--text)' }}>
                          {msg.reply.sender_name_snapshot === profile?.display_name ? 'You' : msg.reply.sender_name_snapshot}
                        </p>
                        <p style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {(() => {
                            const { icon: ReplyIcon, text } = getReplyPreview(msg.reply)
                            return (
                              <>
                                {ReplyIcon && <ReplyIcon size={12} {...iconProps} style={{ flexShrink: 0 }} />}
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
                              </>
                            )
                          })()}
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
                          className="relay-input"
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            borderRadius: '8px',
                            fontSize: '16px',
                            fontFamily: 'inherit',
                          }}
                        />
                        <button
                          onClick={() => handleEdit(msg.id)}
                          style={{
                            padding: '8px 12px',
                            background: 'var(--text)',
                            color: 'var(--background)',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '700',
                            fontFamily: 'inherit',
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setEditContent('') }}
                          style={{
                            padding: '8px 12px',
                            background: 'var(--surface)',
                            color: 'var(--text)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '600',
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
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            pointerEvents: 'none',
                          }}>
                            <Reply size={18} {...iconProps} />
                          </div>
                        )}
                        <div style={{
                          transform: `translateX(${swipeMsgId === msg.id ? swipeDx : 0}px)`,
                          transition: (swipeActive && swipeMsgId === msg.id) ? 'none' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        }}>
                          {(msg.type === 'image' || msg.type === 'audio' || msg.type === 'file') ? (
                            <MediaMessage message={msg} isOwn={isOwn} />
                          ) : (
                            <div
                              style={{
                                padding: isDeleted ? '8px 12px' : '10px 14px',
                                background: isDeleted ? 'var(--gray-100)' : isOwn ? 'var(--text)' : 'var(--gray-100)',
                                color: isDeleted ? 'var(--text-tertiary)' : isOwn ? 'var(--background)' : 'var(--text)',
                                borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                                border: isDeleted ? '1px solid var(--border)' : isOwn ? '2px solid var(--accent)' : '2px solid var(--border-strong)',
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
                              // The wrap's own box touches the bubble with
                              // zero gap (bottom: 100%, not +6px) — a real
                              // empty gap there meant the cursor crossed
                              // genuinely unhovered space on its way from
                              // the bubble to the bar, which instantly
                              // killed pointer-events (that's not animated,
                              // it flips the moment hover breaks) before
                              // the bar could be reached at all. The visual
                              // gap now comes from paddingBottom below,
                              // which is still part of this element's own
                              // hoverable box.
                              bottom: '100%',
                              paddingBottom: '6px',
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
                              onSelect={() => handleEnterSelectMode(msg)}
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
                        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>edited</span>
                      )}
                      <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
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
              background: 'var(--surface)',
              borderRadius: '4px 16px 16px 16px',
              border: '2px solid var(--border-strong)',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              fontStyle: 'italic',
            }}>
              {typingUsers.length === 1
                ? `${typingUsers[0].displayName} is typing…`
                : 'Several people are typing…'}
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
            background: 'var(--surface)',
            border: '2px solid var(--border-strong)',
            color: 'var(--text)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-hard-sm)',
            zIndex: 20,
          }}
        >
          <ArrowDown size={18} {...iconProps} />
          {newMessageCount > 0 && (
            <div style={{
              position: 'absolute',
              top: '-6px',
              right: '-6px',
              minWidth: '18px',
              height: '18px',
              padding: '0 4px',
              background: 'var(--accent)',
              border: '1.5px solid var(--border-strong)',
              borderRadius: '100px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: '800',
              color: 'var(--on-accent)',
            }}>
              {newMessageCount > 99 ? '99+' : newMessageCount}
            </div>
          )}
        </button>
      )}

      {/* Reply preview */}
      {replyTo && (
        <div className="relay-fade-in" style={{
          padding: '8px 16px',
          background: 'var(--surface)',
          borderTop: '2px solid var(--border-strong)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0,
        }}>
          <div style={{
            flex: 1,
            borderLeft: '3px solid var(--accent)',
            paddingLeft: '10px',
          }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text)', marginBottom: '2px' }}>
              Replying to {replyTo.sender_name_snapshot}
            </p>
            <p style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {(() => {
                const { icon: ReplyIcon, text } = getReplyPreview(replyTo)
                return (
                  <>
                    {ReplyIcon && <ReplyIcon size={12} {...iconProps} style={{ flexShrink: 0 }} />}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
                  </>
                )
              })()}
            </p>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            aria-label="Cancel reply"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              display: 'flex',
              padding: '4px',
            }}
          >
            <X size={16} {...iconProps} />
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
          background: 'var(--surface)',
          borderTop: '2px solid var(--border-strong)',
          flexShrink: 0,
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '2px solid var(--border-strong)',
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
                  border: '1px solid var(--border)',
                }}
              />
            ) : (
              <div style={{
                width: '44px',
                height: '44px',
                background: 'var(--gray-100)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                flexShrink: 0,
              }}>
                <FileText size={20} {...iconProps} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: '13px',
                fontWeight: '600',
                color: 'var(--text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginBottom: '2px',
              }}>
                {mediaPreview.file.name}
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                {(mediaPreview.file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              onClick={handleConfirmMediaUpload}
              disabled={sending}
              className="relay-icon-btn relay-icon-btn--accent"
              style={{ width: 'auto', padding: '8px 16px', fontSize: '13px', fontWeight: '700' }}
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
            <button
              onClick={() => {
                if (mediaPreview.previewUrl) URL.revokeObjectURL(mediaPreview.previewUrl)
                setMediaPreview(null)
              }}
              aria-label="Remove attachment"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
                display: 'flex',
                padding: '4px',
                flexShrink: 0,
              }}
            >
              <X size={18} {...iconProps} />
            </button>
          </div>
        </div>
      )}

      {showSearch && (
        <div className="relay-fade-in" style={{
          borderTop: '2px solid var(--border-strong)',
          background: 'var(--surface)',
          flexShrink: 0,
          maxHeight: '300px',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-light)' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search messages…"
              autoFocus
              className="relay-input"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {searching && (
              <p style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-tertiary)' }}>Searching…</p>
            )}
            {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
              <p style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-tertiary)' }}>No messages found</p>
            )}
            {searchResults.map(msg => (
              <div
                key={msg.id}
                className="relay-menu-row"
                style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid var(--border-light)',
                  borderRadius: 0,
                  display: 'block',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  const el = document.getElementById(`msg-${msg.id}`)
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    el.style.background = 'var(--accent-light)'
                    setTimeout(() => el.style.background = '', 2000)
                  }
                  setShowSearch(false)
                }}
              >
                <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text)', marginBottom: '2px' }}>
                  {msg.sender_name_snapshot}
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {msg.content}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  {formatTime(msg.created_at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {showMentions && (
        <div className="relay-popover" style={{
          background: 'var(--surface)',
          border: '2px solid var(--border-strong)',
          borderRadius: '12px',
          margin: '0 16px 8px',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-hard-sm)',
          flexShrink: 0,
          transformOrigin: 'bottom left',
        }}>
          {mentionResults.map(member => (
            <div
              key={member.user_id || member.id}
              onClick={() => handleMentionSelect(member)}
              className="relay-menu-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: 0,
                borderBottom: '1px solid var(--border-light)',
              }}
            >
              <Avatar src={member.avatar_url} name={member.display_name} size={32} userId={member.user_id || member.id} />
              <div>
                <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>{member.display_name}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>@{member.username}</p>
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
          borderTop: '2px solid var(--border-strong)',
          display: 'flex',
          gap: '10px',
          background: 'var(--surface)',
          flexShrink: 0,
        }}>
          <button
            onClick={handleBulkDelete}
            disabled={!canBulkDelete}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '12px',
              background: 'none',
              border: 'none',
              color: canBulkDelete ? 'var(--error)' : 'var(--text-tertiary)',
              opacity: canBulkDelete ? 1 : 0.5,
              fontSize: '14px',
              fontWeight: '700',
              cursor: canBulkDelete ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
            }}
          >
            <Trash2 size={16} {...iconProps} /> Delete
          </button>
          <button
            disabled
            title="Coming soon"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '12px',
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              opacity: 0.5,
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'not-allowed',
              fontFamily: 'inherit',
            }}
          >
            <Forward size={16} {...iconProps} /> Forward
          </button>
          <button
            onClick={handleBulkCopy}
            disabled={selectedMsgIds.size === 0}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '12px',
              background: 'none',
              border: 'none',
              color: selectedMsgIds.size > 0 ? 'var(--text)' : 'var(--text-tertiary)',
              opacity: selectedMsgIds.size > 0 ? 1 : 0.5,
              fontSize: '14px',
              fontWeight: '700',
              cursor: selectedMsgIds.size > 0 ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
            }}
          >
            <Copy size={16} {...iconProps} /> Copy all
          </button>
        </div>
      ) : conversation?.pendingRequestAsSender ? (
        <div style={{
          padding: '16px 20px',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
          borderTop: '2px solid var(--border-strong)',
          background: 'var(--surface)',
          flexShrink: 0,
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-tertiary)' }}>
            Message request sent — you can send more once it&apos;s accepted.
          </p>
        </div>
      ) : conversation?.pendingRequestAsReceiver ? (
        <div style={{
          padding: '16px 20px',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
          borderTop: '2px solid var(--border-strong)',
          background: 'var(--surface)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}>
          <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>
            This is a message request.
          </p>
          <button
            onClick={handleAcceptRequest}
            disabled={acceptingRequest}
            className="relay-btn relay-btn--filled"
            style={{ padding: '10px 18px', fontSize: '13px', flexShrink: 0 }}
          >
            {acceptingRequest ? 'Accepting...' : 'Accept'}
          </button>
        </div>
      ) : (
      <div className="chat-input-bar" style={{
        position: 'sticky',
        bottom: 0,
        padding: '12px 16px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
        borderTop: '2px solid var(--border-strong)',
        background: 'var(--surface)',
        flexShrink: 0,
      }}>
        {errorMsg && (
          <p style={{
            fontSize: '12px',
            color: 'var(--error)',
            marginBottom: '6px',
          }}>
            {errorMsg}
          </p>
        )}
        {content.length >= 1600 && (
          <p style={{
            fontSize: '11px',
            color: content.length >= 2000 ? 'var(--error)' : 'var(--text-tertiary)',
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
            className="relay-icon-btn"
            style={{ borderRadius: '10px', cursor: 'pointer' }}
            title="Attach file"
          >
            <Paperclip size={18} {...iconProps} />
          </label>
          <button
            onClick={() => setShowCamera(true)}
            className="relay-icon-btn"
            style={{ borderRadius: '10px' }}
            title="Camera"
          >
            <Camera size={18} {...iconProps} />
          </button>
          <button
            onClick={() => setShowRecorder(true)}
            className="relay-icon-btn"
            style={{ borderRadius: '10px' }}
            title="Voice message"
          >
            <Mic size={18} {...iconProps} />
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
          placeholder="Message…"
          rows={1}
          maxLength={2000}
          className="relay-input"
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: 'var(--radius-pill)',
            fontSize: '16px',
            resize: 'none',
            lineHeight: '1.5',
            maxHeight: '120px',
            overflowY: 'auto',
          }}
          onInput={e => {
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
          }}
        />
        {/* The one bold accent moment on this screen, same idea as
            ChatList's "+" button — everything else here is neutral. */}
        <button
          onClick={handleSend}
          disabled={!content.trim() || sending}
          aria-label="Send"
          className={content.trim() ? 'relay-icon-btn relay-icon-btn--accent' : 'relay-icon-btn'}
          style={{ borderRadius: '10px', cursor: content.trim() ? 'pointer' : 'not-allowed', opacity: content.trim() ? 1 : 0.5 }}
        >
          <Send size={18} strokeWidth={2.25} strokeLinecap="square" strokeLinejoin="miter" />
        </button>
        </div>
      </div>
      )}

      <style>{`
        .mobile-back-btn { display: flex; }
        .desktop-close-btn { display: none; }
        @media (min-width: 769px) {
          .mobile-back-btn { display: none; }
          .desktop-close-btn { display: flex; }
        }
        /* Desktop hover action bar: invisible until the bubble itself is
           hovered, pure CSS so hovering doesn't trigger a React re-render
           per message. Hidden entirely on mobile, which uses long-press
           (MessageActionSheet) instead.
           Scoped to .message-bubble, not .message-row — the row is a flex
           item stretched to the full width of the message list (needed so
           row-reverse can right-align "own" messages), so triggering on
           row-hover meant any empty space beside a short bubble, anywhere
           along that same horizontal line, would pop the bar open. */
        .message-action-bar-wrap {
          opacity: 0;
          transition: opacity 0.12s;
          pointer-events: none;
        }
        .message-bubble:hover .message-action-bar-wrap {
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
