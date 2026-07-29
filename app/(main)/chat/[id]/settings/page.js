'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Avatar from '@/components/shared/Avatar'
import CopyUsernameButton from '@/components/profile/CopyUsernameButton'
import { getConversation, getPinnedMessages, hideConversation } from '@/actions/messages'
import { getGroupInfo } from '@/actions/groups'
import { getMuteStatus, muteConversation, unmuteConversation } from '@/actions/conversations'
import { cache } from '@/lib/cache'

const MUTE_OPTIONS = [
  { label: '1 hour', hours: 1 },
  { label: '8 hours', hours: 8 },
  { label: '1 week', hours: 24 * 7 },
  { label: 'Forever', hours: null },
]

export default function ConversationSettingsPage() {
  const { id } = useParams()
  const router = useRouter()

  const [conversation, setConversation] = useState(null)
  const [groupInfo, setGroupInfo] = useState(null)
  const [otherParticipant, setOtherParticipant] = useState(null)
  const [muteStatus, setMuteStatus] = useState({ muted: false, mutedUntil: null })
  const [pinnedCount, setPinnedCount] = useState(0)
  const [showMutePicker, setShowMutePicker] = useState(false)
  const [muting, setMuting] = useState(false)
  const [hiding, setHiding] = useState(false)

  useEffect(() => {
    async function load() {
      // Reuse whatever the conversation page already cached — no need to
      // re-fetch conversation/group metadata we just fetched a moment ago.
      const cachedConv = cache.get(`conversation:${id}`)
      const cachedMute = cache.get(`mute:${id}`)

      if (cachedConv) {
        setConversation(cachedConv)
        setOtherParticipant(cachedConv.participants?.[0] || null)
      }
      if (cachedMute) setMuteStatus(cachedMute)

      const convPromise = cachedConv
        ? Promise.resolve({ data: cachedConv })
        : (async () => {
            const result = await getConversation(id)
            if (result.data) cache.set(`conversation:${id}`, result.data, 60000)
            return result
          })()

      const mutePromise = cachedMute
        ? Promise.resolve(cachedMute)
        : (async () => {
            const result = await getMuteStatus(id)
            cache.set(`mute:${id}`, result, 30000)
            return result
          })()

      const [convResult, muteResult, pinnedResult] = await Promise.all([
        convPromise,
        mutePromise,
        getPinnedMessages(id),
      ])

      if (convResult.data) {
        setConversation(convResult.data)
        setOtherParticipant(convResult.data.participants?.[0] || null)

        if (convResult.data.type === 'group') {
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

      setMuteStatus(muteResult)
      if (pinnedResult.data) setPinnedCount(pinnedResult.data.length)
    }
    load()
  }, [id])

  const handleMute = async (hours) => {
    setMuting(true)
    const mutedUntil = hours ? Date.now() + hours * 3600000 : null
    const result = await muteConversation(id, mutedUntil)
    if (!result.error) {
      setMuteStatus({ muted: true, mutedUntil: mutedUntil ? new Date(mutedUntil).toISOString() : null })
      cache.invalidate(`mute:${id}`)
      setShowMutePicker(false)
    }
    setMuting(false)
  }

  const handleUnmute = async () => {
    setMuting(true)
    const result = await unmuteConversation(id)
    if (!result.error) {
      setMuteStatus({ muted: false, mutedUntil: null })
      cache.invalidate(`mute:${id}`)
    }
    setMuting(false)
  }

  const handleHide = async () => {
    if (!confirm('Hide this conversation? It will move to your hidden chats and stay there until you unhide it.')) return
    setHiding(true)
    await hideConversation(id)
    router.replace('/chat')
  }

  if (!conversation) return null

  const isGroup = conversation?.type === 'group'

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      background: '#F5F5F5',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <div style={{
        background: '#fff',
        borderBottom: '1.5px solid #0a0a0a',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <button onClick={() => router.push(`/chat/${id}`)} style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textDecoration: 'none',
          color: '#0a0a0a',
          fontSize: '14px',
          fontWeight: '600',
          fontFamily: 'inherit',
        }}>
          ← Back
        </button>
        <span style={{ fontSize: '16px', fontWeight: '700' }}>Conversation settings</span>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Identity card */}
        <div style={{
          background: '#fff',
          border: '1.5px solid #0a0a0a',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '4px 4px 0 #0a0a0a',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          {isGroup ? (
            <>
              <Avatar src={groupInfo?.avatar_url} name={groupInfo?.name} size={64} />
              <div>
                <p style={{ fontSize: '18px', fontWeight: '800', color: '#0a0a0a', marginBottom: '2px' }}>
                  {groupInfo?.name}
                </p>
                <p style={{ fontSize: '13px', color: '#A3A3A3' }}>
                  {groupInfo?.members?.length || 0} members
                </p>
              </div>
            </>
          ) : (
            <>
              <Avatar src={otherParticipant?.avatar_url} name={otherParticipant?.display_name} size={64} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '18px', fontWeight: '800', color: '#0a0a0a', marginBottom: '2px' }}>
                  {otherParticipant?.display_name}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <p style={{ fontSize: '13px', color: '#A3A3A3' }}>
                    @{otherParticipant?.username}
                  </p>
                  <CopyUsernameButton username={otherParticipant?.username} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Mute section */}
        <div style={{
          background: '#fff',
          border: '1.5px solid #0a0a0a',
          borderRadius: '16px',
          boxShadow: '4px 4px 0 #0a0a0a',
          marginBottom: '20px',
        }}>
          <div style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            position: 'relative',
          }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: '600', color: '#0a0a0a', marginBottom: '2px' }}>
                Notifications
              </p>
              <p style={{ fontSize: '12px', color: '#A3A3A3' }}>
                {muteStatus.muted
                  ? muteStatus.mutedUntil
                    ? `Muted until ${new Date(muteStatus.mutedUntil).toLocaleString()}`
                    : 'Muted forever'
                  : 'Notifications are on'}
              </p>
            </div>

            {muteStatus.muted ? (
              <button
                onClick={handleUnmute}
                disabled={muting}
                style={{
                  padding: '8px 16px',
                  background: '#fff',
                  color: '#0a0a0a',
                  border: '1.5px solid #0a0a0a',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: muting ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  flexShrink: 0,
                }}
              >
                Unmute
              </button>
            ) : (
              <button
                onClick={() => setShowMutePicker(prev => !prev)}
                style={{
                  padding: '8px 16px',
                  background: '#0a0a0a',
                  color: '#fff',
                  border: '1.5px solid #0a0a0a',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '2px 2px 0 #FFB800',
                  flexShrink: 0,
                }}
              >
                Mute
              </button>
            )}

            {showMutePicker && (
              <>
                <div
                  onClick={() => setShowMutePicker(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 15 }}
                />
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: '20px',
                  marginTop: '4px',
                  background: '#fff',
                  border: '1.5px solid #0a0a0a',
                  borderRadius: '12px',
                  boxShadow: '3px 3px 0 #0a0a0a',
                  overflow: 'hidden',
                  zIndex: 20,
                  minWidth: '160px',
                }}>
                  {MUTE_OPTIONS.map(opt => (
                    <button
                      key={opt.label}
                      disabled={muting}
                      onClick={() => handleMute(opt.hours)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 16px',
                        background: 'none',
                        border: 'none',
                        borderBottom: '1px solid #F5F5F5',
                        fontSize: '13px',
                        color: '#0a0a0a',
                        cursor: muting ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Pinned messages */}
        <Link href={`/chat/${id}`} style={{ textDecoration: 'none' }}>
          <div style={{
            background: '#fff',
            border: '1.5px solid #0a0a0a',
            borderRadius: '16px',
            padding: '16px 20px',
            boxShadow: '4px 4px 0 #0a0a0a',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#0a0a0a' }}>
              📌 Pinned messages
            </span>
            <span style={{ fontSize: '14px', color: '#A3A3A3' }}>
              {pinnedCount} →
            </span>
          </div>
        </Link>

        {/* Actions */}
        <div style={{
          background: '#fff',
          border: '1.5px solid #0a0a0a',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '4px 4px 0 #0a0a0a',
          marginBottom: '20px',
        }}>
          {!isGroup && (
            <Link href={`/u/${otherParticipant?.username}?from=conversation-settings&convId=${id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #F5F5F5',
                cursor: 'pointer',
              }}>
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>
                  View profile
                </span>
                <span style={{ color: '#A3A3A3', fontSize: '14px' }}>→</span>
              </div>
            </Link>
          )}
          <div
            onClick={handleHide}
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: hiding ? 'not-allowed' : 'pointer',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#EF4444' }}>
              {hiding ? 'Hiding...' : 'Hide conversation'}
            </span>
            <span style={{ color: '#A3A3A3', fontSize: '14px' }}>→</span>
          </div>
        </div>
      </div>
    </div>
  )
}
