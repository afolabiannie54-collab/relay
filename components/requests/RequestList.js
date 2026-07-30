'use client'

import { useState, useEffect } from 'react'
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

  const tabStyle = (active) => ({
    flex: 1,
    padding: '12px',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2.5px solid #0a0a0a' : '2.5px solid transparent',
    fontSize: '14px',
    fontWeight: active ? '800' : '600',
    color: active ? '#0a0a0a' : '#A3A3A3',
    cursor: 'pointer',
    fontFamily: 'inherit',
  })

  const list = tab === 'received' ? received : sent

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 0',
        borderBottom: '1.5px solid #E5E5E5',
        background: '#fff',
      }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#0a0a0a', marginBottom: '12px' }}>Requests</h1>
        <div style={{ display: 'flex' }}>
          <button style={tabStyle(tab === 'received')} onClick={() => setTab('received')}>
            Received{received.length > 0 ? ` (${received.length})` : ''}
          </button>
          <button style={tabStyle(tab === 'sent')} onClick={() => setTab('sent')}>
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
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📨</div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px' }}>
              {tab === 'received' ? 'No requests' : 'No pending requests'}
            </h2>
            <p style={{ fontSize: '14px', color: '#A3A3A3' }}>
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
                  background: '#fff',
                  border: '1.5px solid #0a0a0a',
                  borderRadius: '12px',
                  padding: '16px',
                  boxShadow: '3px 3px 0 #0a0a0a',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <Avatar src={request.sender?.avatar_url} name={request.sender?.display_name} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '15px', fontWeight: '700', color: '#0a0a0a' }}>
                      {request.sender?.display_name}
                    </p>
                    <p style={{ fontSize: '12px', color: '#A3A3A3' }}>@{request.sender?.username}</p>
                  </div>
                  <span style={{ fontSize: '11px', color: '#A3A3A3', flexShrink: 0 }}>
                    {formatTime(request.created_at)}
                  </span>
                </div>

                {request.message?.content && (
                  <div style={{
                    padding: '10px 14px',
                    background: '#F5F5F5',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#525252',
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
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: acting === request.id ? '#525252' : '#0a0a0a',
                      color: '#fff',
                      border: '1.5px solid #0a0a0a',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '700',
                      cursor: acting === request.id ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                      boxShadow: acting === request.id ? 'none' : '2px 2px 0 #FFB800',
                    }}
                  >
                    {acting === request.id ? 'Accepting...' : 'Accept'}
                  </button>
                  <button
                    onClick={() => setBlockTarget({ requestId: request.id, userId: request.sender?.id })}
                    disabled={acting === request.id}
                    style={{
                      padding: '10px 16px',
                      background: '#fff',
                      color: '#EF4444',
                      border: '1.5px solid #EF4444',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Block
                  </button>
                </div>
              </div>
            )) : sent.map(request => (
              <div
                key={request.id}
                style={{
                  background: '#fff',
                  border: '1.5px solid #0a0a0a',
                  borderRadius: '12px',
                  padding: '16px',
                  boxShadow: '3px 3px 0 #0a0a0a',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <Avatar src={request.receiver?.avatar_url} name={request.receiver?.display_name} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '15px', fontWeight: '700', color: '#0a0a0a' }}>
                      {request.receiver?.display_name}
                    </p>
                    <p style={{ fontSize: '12px', color: '#A3A3A3' }}>@{request.receiver?.username}</p>
                  </div>
                  <span style={{ fontSize: '11px', color: '#A3A3A3', flexShrink: 0 }}>
                    {formatTime(request.created_at)}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#A3A3A3',
                    padding: '4px 10px',
                    background: '#F5F5F5',
                    borderRadius: '100px',
                  }}>
                    Pending
                  </span>
                  <button
                    onClick={() => handleCancel(request.id)}
                    disabled={acting === request.id}
                    style={{
                      padding: '8px 14px',
                      background: '#fff',
                      color: '#525252',
                      border: '1.5px solid #E5E5E5',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
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
