'use client'

import { useState, useEffect } from 'react'
import Avatar from '@/components/shared/Avatar'
import { getMessageRequests, acceptMessageRequest, cancelMessageRequest } from '@/actions/messages'
import { useRouter } from 'next/navigation'

export default function RequestsPage() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(null)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const result = await getMessageRequests()
      if (result.data) setRequests(result.data)
      setLoading(false)
    }
    load()
  }, [])

  const handleAccept = async (requestId) => {
    setActing(requestId)
    const result = await acceptMessageRequest(requestId)
    if (result.success) {
      setRequests(prev => prev.filter(r => r.id !== requestId))
      router.push(`/chat/${result.conversationId}`)
    }
    setActing(null)
  }

  const handleBlock = async (requestId) => {
    // Block will be implemented in Phase 9
    // For now just remove from list
    setRequests(prev => prev.filter(r => r.id !== requestId))
  }

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
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1.5px solid #E5E5E5',
        background: '#fff',
      }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#0a0a0a' }}>Requests</h1>
        <p style={{ fontSize: '13px', color: '#A3A3A3', marginTop: '2px' }}>
          People who want to message you
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {requests.length === 0 ? (
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
            <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px' }}>No requests</h2>
            <p style={{ fontSize: '14px', color: '#A3A3A3' }}>
              When someone wants to message you for the first time, it will appear here.
            </p>
          </div>
        ) : (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {requests.map(request => (
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
                {/* Sender info */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '12px',
                }}>
                  <Avatar
                    src={request.sender?.avatar_url}
                    name={request.sender?.display_name}
                    size={44}
                  />
                  <div>
                    <p style={{ fontSize: '15px', fontWeight: '700', color: '#0a0a0a' }}>
                      {request.sender?.display_name}
                    </p>
                    <p style={{ fontSize: '12px', color: '#A3A3A3' }}>
                      @{request.sender?.username}
                    </p>
                  </div>
                </div>

                {/* Message preview */}
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

                {/* Actions */}
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
                    onClick={() => handleBlock(request.id)}
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}