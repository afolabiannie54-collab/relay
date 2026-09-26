'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft } from 'lucide-react'
import Avatar from '@/components/shared/Avatar'
import ConfirmSheet from '@/components/shared/ConfirmSheet'
import {
  getMessageRequests,
  getSentMessageRequests,
  acceptMessageRequest,
  cancelMessageRequest,
} from '@/actions/messages'
import { getGroupInvites, acceptGroupInvite, declineGroupInvite } from '@/actions/groups'
import { blockUser } from '@/actions/blocks'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NotionDoodle from '@/components/shared/illustrations/NotionDoodle'

const INBOX_PATH = "M7.15385 6H16.8462M5 10H19M22.5567 14.2593V20.3568C22.5567 20.9091 22.109 21.3568 21.5567 21.3568H1.51326M22.5567 14.2593L22.9795 21.4605C22.9875 21.597 22.8563 21.6929 22.7334 21.6556M22.5567 14.2593L22.6772 20.7055M22.5567 14.2593L19.6672 2.75637C19.5555 2.31174 19.1558 2 18.6973 2H4.86897C4.40611 2 4.00373 2.31765 3.89629 2.76788L1.02731 14.7901C1.00917 14.8661 1 14.944 1 15.0222V20.8436C1 21.127 1.22979 21.3568 1.51326 21.3568M1.51326 21.3568L22.3492 21.6345M1.51326 21.3568C9.30915 21.7684 24.3756 22.399 22.7334 21.6556M22.6946 21.6391L22.3492 21.6345M22.6946 21.6391L22.6772 20.7055M22.6946 21.6391C22.7085 21.6447 22.7214 21.6502 22.7334 21.6556M22.6946 21.6391C22.7074 21.6462 22.7203 21.6516 22.7334 21.6556M22.3492 21.6345L22.6772 20.7055M3.5 13.7874H6.24946C6.62859 13.7874 6.97511 14.0018 7.14433 14.341L8.11473 16.2866C8.28394 16.6258 8.63047 16.8402 9.00959 16.8402H14.5333C14.9196 16.8402 15.2714 16.6178 15.4369 16.2687L16.3426 14.3589C16.5081 14.0098 16.8598 13.7874 17.2461 13.7874H20"

const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

function formatTime(timestamp) {
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

function Spinner({ size = 14 }) {
  // Same dark-mode fix as the identical spinners in NewConversationSheet.js
  // and AudioPlayer.js — a hardcoded white track goes nearly invisible once
  // --text (this spinner's filled-button surface) flips to near-white in
  // dark theme. color-mix tracks --background instead, same as borderTopColor.
  return (
    <div style={{
      width: size,
      height: size,
      border: '2px solid color-mix(in srgb, var(--background) 35%, transparent)',
      borderTopColor: 'var(--background)',
      borderRadius: '50%',
      animation: 'relay-req-spin 0.7s linear infinite',
      flexShrink: 0,
    }}>
      <style>{`@keyframes relay-req-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function RequestList({ initialReceived, initialSent, initialInvites, userId }) {
  const [tab, setTab] = useState('received')

  // Applied post-mount rather than read synchronously during the initial
  // render (matches app/(main)/layout.js's sidebar-collapsed default) —
  // reading window.location here during render would make the server-
  // rendered HTML and the client's first render disagree on which tab is
  // active, a hydration mismatch. Plain browser API instead of
  // next/navigation's useSearchParams(), which would force this whole
  // component under a Suspense boundary just for this one deep link
  // (?tab=invites, used by the group-invite notification).
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('tab')
    if (['received', 'sent', 'invites'].includes(param)) setTab(param)
  }, [])
  const [received, setReceived] = useState(initialReceived)
  const [sent, setSent] = useState(initialSent)
  const [invites, setInvites] = useState(initialInvites || [])
  // A Set of in-flight request/invite ids, not a single scalar — one
  // shared "the current action" id meant starting a second action (even
  // on a totally different row, or a different tab entirely) cleared the
  // first row's disabled/spinner state while its own request was still
  // in flight, letting a second tap fire a duplicate accept/cancel call.
  const [acting, setActing] = useState(() => new Set())
  const isActing = (id) => acting.has(id)
  const startActing = (id) => setActing(prev => new Set(prev).add(id))
  const stopActing = (id) => setActing(prev => {
    const next = new Set(prev)
    next.delete(id)
    return next
  })
  const [blockTarget, setBlockTarget] = useState(null)
  const [actionError, setActionError] = useState(null)
  const router = useRouter()

  const showActionError = (msg) => {
    setActionError(msg || 'Something went wrong')
    setTimeout(() => setActionError(null), 3000)
  }

  // Live-refresh all three lists — a new request/invite coming in affects
  // Received/Invites, an existing one being cancelled from another device
  // affects Sent.
  useEffect(() => {
    if (!userId) return

    const refreshReceived = async () => {
      const result = await getMessageRequests()
      if (result.data) setReceived(result.data)
    }
    const refreshSent = async () => {
      const result = await getSentMessageRequests()
      if (result.data) setSent(result.data)
    }
    const refreshInvites = async () => {
      const result = await getGroupInvites()
      if (result.data) setInvites(result.data)
    }

    const supabase = createClient()
    const channel = supabase
      .channel('requests-list')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_requests',
        filter: `receiver_id=eq.${userId}`,
      }, refreshReceived)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_requests',
        filter: `sender_id=eq.${userId}`,
      }, refreshSent)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_invites',
        filter: `invitee_id=eq.${userId}`,
      }, refreshInvites)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const handleAccept = async (requestId) => {
    if (isActing(requestId)) return
    startActing(requestId)
    const result = await acceptMessageRequest(requestId)
    if (result.success) {
      setReceived(prev => prev.filter(r => r.id !== requestId))
      router.push(`/chat/${result.conversationId}`)
      return
    }
    stopActing(requestId)
    showActionError(result.error)
  }

  const handleBlock = async () => {
    if (!blockTarget) return
    const { requestId, userId: blockedUserId } = blockTarget
    if (isActing(requestId)) return
    startActing(requestId)
    const result = await blockUser(blockedUserId)
    stopActing(requestId)
    if (result?.error) return result
    setReceived(prev => prev.filter(r => r.id !== requestId))
    setBlockTarget(null)
    return result
  }

  const handleCancel = async (requestId) => {
    if (isActing(requestId)) return
    startActing(requestId)
    const result = await cancelMessageRequest(requestId)
    if (result.success) {
      setSent(prev => prev.filter(r => r.id !== requestId))
    } else {
      showActionError(result.error)
    }
    stopActing(requestId)
  }

  const handleAcceptInvite = async (inviteId) => {
    if (isActing(inviteId)) return
    startActing(inviteId)
    const result = await acceptGroupInvite(inviteId)
    if (result.success) {
      setInvites(prev => prev.filter(i => i.id !== inviteId))
      router.push(`/chat/${result.conversationId}`)
      return
    }
    stopActing(inviteId)
    showActionError(result.error)
  }

  const handleDeclineInvite = async (inviteId) => {
    if (isActing(inviteId)) return
    startActing(inviteId)
    const result = await declineGroupInvite(inviteId)
    if (result.success) {
      setInvites(prev => prev.filter(i => i.id !== inviteId))
    } else {
      showActionError(result.error)
    }
    stopActing(inviteId)
  }

  const list = tab === 'received' ? received : tab === 'sent' ? sent : invites

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Header — same border-bottom every other page uses now that the
          pill toggle below has its own separate row/divider, instead of
          being the reason this header used to skip the border entirely. */}
      <div style={{ padding: '14px 24px', borderBottom: '2px solid var(--border-strong)', background: 'var(--surface)' }}>
        <div className="relay-page-header-row" style={{ gap: '6px' }}>
          <button
            onClick={() => router.push('/chat')}
            aria-label="Back"
            className="relay-plain-icon-btn"
            style={{ width: '34px', height: '34px', marginLeft: '-8px', flexShrink: 0 }}
          >
            <ChevronLeft size={22} {...iconProps} />
          </button>
          <h1 className="relay-page-title">Requests</h1>
        </div>
      </div>

      {/* Pill toggle — its own row now, same bold divider as the header.
          Scrolls horizontally rather than wrapping/shrinking — three
          labeled+counted pills ("Group invites (N)" is the long one)
          don't reliably fit a 400px-wide screen, and .relay-btn has no
          white-space handling of its own to fall back on. */}
      <div style={{ display: 'flex', gap: '8px', padding: '12px 24px', borderBottom: '2px solid var(--border-strong)', background: 'var(--surface)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <button
          onClick={() => setTab('received')}
          className={tab === 'received' ? 'relay-btn relay-btn--filled' : 'relay-btn'}
          style={{ borderRadius: 'var(--radius-pill)', padding: '8px 16px', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          Received{received.length > 0 ? ` (${received.length})` : ''}
        </button>
        <button
          onClick={() => setTab('sent')}
          className={tab === 'sent' ? 'relay-btn relay-btn--filled' : 'relay-btn'}
          style={{ borderRadius: 'var(--radius-pill)', padding: '8px 16px', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          Sent{sent.length > 0 ? ` (${sent.length})` : ''}
        </button>
        <button
          onClick={() => setTab('invites')}
          className={tab === 'invites' ? 'relay-btn relay-btn--filled' : 'relay-btn'}
          style={{ borderRadius: 'var(--radius-pill)', padding: '8px 16px', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          Group invites{invites.length > 0 ? ` (${invites.length})` : ''}
        </button>
      </div>

      {actionError && (
        <div style={{ padding: '10px 24px', background: 'var(--error-light)', borderBottom: '1px solid var(--border-light)', fontSize: '13px', color: 'var(--error)', fontWeight: '600', textAlign: 'center' }}>
          {actionError}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {list.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '40px',
            textAlign: 'center',
          }}>
            <div style={{ marginBottom: '16px' }}>
              <NotionDoodle d={INBOX_PATH} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', marginBottom: '6px', letterSpacing: '-0.01em' }}>
              {tab === 'received' ? 'No requests' : tab === 'sent' ? 'No pending requests' : 'No group invites'}
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', maxWidth: '260px' }}>
              {tab === 'received'
                ? 'When someone wants to message you for the first time, it will appear here.'
                : tab === 'sent'
                ? "Message requests you've sent that haven't been accepted yet will appear here."
                : "Invites to join a group from someone you haven't messaged before will appear here."}
            </p>
          </div>
        ) : (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {tab === 'received' ? received.map(request => (
              <div
                key={request.id}
                style={{
                  background: 'var(--surface)',
                  border: '2px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  boxShadow: 'var(--shadow-hard-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <Avatar src={request.sender?.avatar_url} name={request.sender?.display_name} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)' }}>
                      {request.sender?.display_name}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>@{request.sender?.username}</p>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                    {formatTime(request.created_at)}
                  </span>
                </div>

                {request.message?.content && (
                  <div style={{
                    padding: '10px 14px',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '14px',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.5',
                    marginBottom: '14px',
                  }}>
                    {request.message.content}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => handleAccept(request.id)}
                    disabled={isActing(request.id)}
                    className="relay-btn relay-btn--filled"
                    style={{ flex: 1, padding: '10px', fontSize: '14px' }}
                  >
                    {isActing(request.id) && <Spinner />}
                    {isActing(request.id) ? 'Accepting...' : 'Accept'}
                  </button>
                  <button
                    onClick={() => setBlockTarget({ requestId: request.id, userId: request.sender?.id })}
                    disabled={isActing(request.id)}
                    className="relay-btn"
                    style={{ padding: '10px 16px', fontSize: '14px', color: 'var(--error)', borderColor: 'var(--error)' }}
                  >
                    Block
                  </button>
                </div>
              </div>
            )) : tab === 'sent' ? sent.map(request => (
              <div
                key={request.id}
                style={{
                  background: 'var(--surface)',
                  border: '2px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  boxShadow: 'var(--shadow-hard-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <Avatar src={request.receiver?.avatar_url} name={request.receiver?.display_name} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)' }}>
                      {request.receiver?.display_name}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>@{request.receiver?.username}</p>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                    {formatTime(request.created_at)}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    color: 'var(--text-tertiary)',
                    padding: '4px 10px',
                    background: 'var(--gray-100)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-pill)',
                  }}>
                    Pending
                  </span>
                  <button
                    onClick={() => handleCancel(request.id)}
                    disabled={isActing(request.id)}
                    className="relay-btn"
                    style={{ padding: '8px 14px', fontSize: '13px' }}
                  >
                    {isActing(request.id) ? 'Cancelling...' : 'Cancel'}
                  </button>
                </div>
              </div>
            )) : invites.map(invite => (
              <div
                key={invite.id}
                style={{
                  background: 'var(--surface)',
                  border: '2px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  boxShadow: 'var(--shadow-hard-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <Avatar src={invite.groups?.avatar_url} name={invite.groups?.name} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)' }}>
                      {invite.groups?.name}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                      Invited by @{invite.inviter?.username}
                    </p>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                    {formatTime(invite.created_at)}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => handleAcceptInvite(invite.id)}
                    disabled={isActing(invite.id)}
                    className="relay-btn relay-btn--filled"
                    style={{ flex: 1, padding: '10px', fontSize: '14px' }}
                  >
                    {isActing(invite.id) && <Spinner />}
                    {isActing(invite.id) ? 'Joining...' : 'Accept'}
                  </button>
                  <button
                    onClick={() => handleDeclineInvite(invite.id)}
                    disabled={isActing(invite.id)}
                    className="relay-btn"
                    style={{ padding: '10px 16px', fontSize: '14px' }}
                  >
                    {isActing(invite.id) ? 'Declining...' : 'Decline'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmSheet
        isOpen={!!blockTarget}
        onClose={() => setBlockTarget(null)}
        title="Block this user?"
        message="They won't be able to message you again, and this request will be removed."
        confirmLabel="Block"
        confirmStyle="danger"
        onConfirm={handleBlock}
      />
    </div>
  )
}
