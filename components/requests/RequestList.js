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
  return (
    <div style={{
      width: size,
      height: size,
      border: '2px solid rgba(255,255,255,0.3)',
      borderTopColor: 'var(--background)',
      borderRadius: '50%',
      animation: 'relay-req-spin 0.7s linear infinite',
      flexShrink: 0,
    }}>
      <style>{`@keyframes relay-req-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function RequestList({ initialReceived, initialSent, userId }) {
  const [tab, setTab] = useState('received')
  const [received, setReceived] = useState(initialReceived)
  const [sent, setSent] = useState(initialSent)
  const [acting, setActing] = useState(null)
  const [blockTarget, setBlockTarget] = useState(null)
  const router = useRouter()

  // Live-refresh both lists — a new request coming in affects Received,
  // an existing one being cancelled from another device affects Sent.
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
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const handleAccept = async (requestId) => {
    setActing(requestId)
    const result = await acceptMessageRequest(requestId)
    if (result.success) {
      setReceived(prev => prev.filter(r => r.id !== requestId))
      router.push(`/chat/${result.conversationId}`)
      return
    }
    setActing(null)
  }

  const handleBlock = async () => {
    if (!blockTarget) return
    const { requestId, userId: blockedUserId } = blockTarget
    setActing(requestId)
    await blockUser(blockedUserId)
    setReceived(prev => prev.filter(r => r.id !== requestId))
    setActing(null)
    setBlockTarget(null)
  }

  const handleCancel = async (requestId) => {
    setActing(requestId)
    const result = await cancelMessageRequest(requestId)
    if (result.success) {
      setSent(prev => prev.filter(r => r.id !== requestId))
    }
    setActing(null)
  }

  const list = tab === 'received' ? received : sent

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{ padding: '14px 20px 0', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <button
          onClick={() => router.push('/chat')}
          aria-label="Back"
          className="relay-plain-icon-btn"
          style={{ marginLeft: '-10px', marginBottom: '10px' }}
        >
          <ChevronLeft size={22} {...iconProps} />
        </button>
        <h1 className="relay-page-title" style={{ marginBottom: '14px' }}>Requests</h1>
        <div style={{ display: 'flex', gap: '8px', paddingBottom: '14px' }}>
          <button
            onClick={() => setTab('received')}
            className={tab === 'received' ? 'relay-btn relay-btn--filled' : 'relay-btn'}
            style={{ borderRadius: 'var(--radius-pill)', padding: '8px 16px' }}
          >
            Received{received.length > 0 ? ` (${received.length})` : ''}
          </button>
          <button
            onClick={() => setTab('sent')}
            className={tab === 'sent' ? 'relay-btn relay-btn--filled' : 'relay-btn'}
            style={{ borderRadius: 'var(--radius-pill)', padding: '8px 16px' }}
          >
            Sent{sent.length > 0 ? ` (${sent.length})` : ''}
          </button>
        </div>
      </div>

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
              <NotionDoodle d={INBOX_PATH} size={88} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', marginBottom: '6px', letterSpacing: '-0.01em' }}>
              {tab === 'received' ? 'No requests' : 'No pending requests'}
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', maxWidth: '260px' }}>
              {tab === 'received'
                ? 'When someone wants to message you for the first time, it will appear here.'
                : "Message requests you've sent that haven't been accepted yet will appear here."}
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
                    disabled={acting === request.id}
                    className="relay-btn relay-btn--filled"
                    style={{ flex: 1, padding: '10px', fontSize: '14px' }}
                  >
                    {acting === request.id && <Spinner />}
                    {acting === request.id ? 'Accepting...' : 'Accept'}
                  </button>
                  <button
                    onClick={() => setBlockTarget({ requestId: request.id, userId: request.sender?.id })}
                    disabled={acting === request.id}
                    className="relay-btn"
                    style={{ padding: '10px 16px', fontSize: '14px', color: 'var(--error)', borderColor: 'var(--error)' }}
                  >
                    Block
                  </button>
                </div>
              </div>
            )) : sent.map(request => (
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
                    disabled={acting === request.id}
                    className="relay-btn"
                    style={{ padding: '8px 14px', fontSize: '13px' }}
                  >
                    {acting === request.id ? 'Cancelling...' : 'Cancel'}
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
