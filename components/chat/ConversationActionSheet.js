'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import BottomSheet from '@/components/shared/BottomSheet'
import ConfirmSheet from '@/components/shared/ConfirmSheet'
import Avatar from '@/components/shared/Avatar'
import { muteConversation, unmuteConversation, deleteConversationForUser } from '@/actions/conversations'
import { markConversationRead, markConversationUnread, hideConversation, unhideConversation } from '@/actions/messages'
import { leaveGroup, addMember } from '@/actions/groups'
import { blockUser } from '@/actions/blocks'
import { searchUsers } from '@/actions/users'
import { cache } from '@/lib/cache'

function vibrate() {
  try { window.navigator.vibrate?.(10) } catch {}
}

// Long-press menu for a conversation tile on mobile. `conversation` is
// one row from getConversations() (has conversation_id, type,
// other_participants, group_info, role, unread_count). onChanged is
// called after any action that should make the list re-fetch.
//
// isHidden switches this to the reduced menu used on /chat/hidden:
// Unhide, Delete conversation, Block user (DM only) — mute/read-state/
// group-management don't apply to a conversation that isn't in the
// active list.
export default function ConversationActionSheet({ conversation, isMuted, isOpen, onClose, onChanged, isHidden = false }) {
  const router = useRouter()
  const pathname = usePathname()
  const [mode, setMode] = useState('menu')
  const [confirmAction, setConfirmAction] = useState(null)
  const [memberQuery, setMemberQuery] = useState('')
  const [memberResults, setMemberResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState(null)

  if (!conversation) return null

  const isGroup = conversation.type === 'group'
  const otherUser = conversation.other_participants?.[0]
  const isUnread = (conversation.unread_count || 0) > 0
  const canManageGroup = ['owner', 'admin'].includes(conversation.role)
  const name = isGroup ? conversation.group_info?.name : otherUser?.display_name
  const avatarUrl = isGroup ? conversation.group_info?.avatar_url : otherUser?.avatar_url

  const close = () => {
    setMode('menu')
    setMemberQuery('')
    setMemberResults([])
    onClose?.()
  }

  // If the conversation being acted on is the one currently open in the
  // right panel, an action that removes it from the list would otherwise
  // leave stale conversation content showing there — navigate back to
  // the empty state so both panels stay in sync.
  const navigateAwayIfOpen = () => {
    if (pathname === `/chat/${conversation.conversation_id}`) {
      router.push('/chat')
    }
  }

  const handleToggleMute = async () => {
    vibrate()
    if (isMuted) {
      await unmuteConversation(conversation.conversation_id)
    } else {
      await muteConversation(conversation.conversation_id, null)
    }
    onChanged?.()
    close()
  }

  const handleToggleRead = async () => {
    vibrate()
    if (isUnread) {
      await markConversationRead(conversation.conversation_id)
    } else {
      await markConversationUnread(conversation.conversation_id)
    }
    onChanged?.()
    close()
  }

  const handleHide = async () => {
    vibrate()
    await hideConversation(conversation.conversation_id)
    onChanged?.()
    navigateAwayIfOpen()
    close()
  }

  const handleUnhide = async () => {
    vibrate()
    await unhideConversation(conversation.conversation_id)
    onChanged?.()
    close()
  }

  const handleDelete = async () => {
    await deleteConversationForUser(conversation.conversation_id)
    // A stale cached page of messages (from before the deletion cutoff)
    // would otherwise serve the full unfiltered history on next open,
    // since getMessages()'s deleted_at filter only ever runs on an
    // actual server fetch, not a cache hit.
    cache.invalidate(`messages:${conversation.conversation_id}`)
    onChanged?.()
    navigateAwayIfOpen()
    close()
  }

  const handleLeaveGroup = async () => {
    await leaveGroup(conversation.conversation_id)
    onChanged?.()
    navigateAwayIfOpen()
    close()
  }

  const handleBlock = async () => {
    if (!otherUser) return
    await blockUser(otherUser.user_id)
    onChanged?.()
    navigateAwayIfOpen()
    close()
  }

  const handleMemberSearch = async (q) => {
    setMemberQuery(q)
    if (q.trim().length < 3) { setMemberResults([]); return }
    setSearching(true)
    const result = await searchUsers(q)
    if (result.data) setMemberResults(result.data)
    setSearching(false)
  }

  const handleAddMember = async (userId) => {
    setAdding(userId)
    await addMember(conversation.conversation_id, userId)
    setAdding(null)
    setMemberResults(prev => prev.filter(u => u.id !== userId))
  }

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 20px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#0a0a0a',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    fontFamily: 'inherit',
  }

  return (
    <>
      <BottomSheet isOpen={isOpen && mode === 'menu'} onClose={close}>
        <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 20px 16px', borderBottom: '1px solid #E5E5E5' }}>
            <Avatar src={avatarUrl} name={name} size={40} />
            <p style={{ fontSize: '15px', fontWeight: '800', color: '#0a0a0a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
          </div>

          <div style={{ padding: '8px 0' }}>
            {isHidden ? (
              <>
                <button style={rowStyle} onClick={handleUnhide}>
                  🙉 Unhide
                </button>
                <button
                  style={{ ...rowStyle, color: '#EF4444' }}
                  onClick={() => setConfirmAction('delete')}
                >
                  🗑️ Delete conversation
                </button>
                {!isGroup && (
                  <button
                    style={{ ...rowStyle, color: '#EF4444' }}
                    onClick={() => setConfirmAction('block')}
                  >
                    🚫 Block user
                  </button>
                )}
              </>
            ) : (
              <>
                <button style={rowStyle} onClick={handleToggleMute}>
                  {isMuted ? '🔔 Unmute' : '🔕 Mute'}
                </button>
                <button style={rowStyle} onClick={handleToggleRead}>
                  {isUnread ? '✓ Mark as read' : '● Mark as unread'}
                </button>
                <button style={rowStyle} onClick={handleHide}>
                  🙈 Hide conversation
                </button>

                {isGroup ? (
                  <>
                    {canManageGroup && (
                      <button style={rowStyle} onClick={() => setMode('addMember')}>
                        ➕ Add member
                      </button>
                    )}
                    <button
                      style={{ ...rowStyle, color: '#EF4444' }}
                      onClick={() => setConfirmAction('leave')}
                    >
                      🚪 Leave group
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      style={{ ...rowStyle, color: '#EF4444' }}
                      onClick={() => setConfirmAction('delete')}
                    >
                      🗑️ Delete conversation
                    </button>
                    <button
                      style={{ ...rowStyle, color: '#EF4444' }}
                      onClick={() => setConfirmAction('block')}
                    >
                      🚫 Block user
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </BottomSheet>

      <BottomSheet isOpen={isOpen && mode === 'addMember'} onClose={close} title="Add member">
        <div style={{ padding: '12px 20px 20px', fontFamily: "'Inter', -apple-system, sans-serif" }}>
          <input
            type="text"
            value={memberQuery}
            onChange={e => handleMemberSearch(e.target.value)}
            placeholder="Search by username..."
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '1.5px solid #E5E5E5',
              borderRadius: '10px',
              fontSize: '16px',
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
              marginBottom: '12px',
            }}
          />
          {searching ? (
            <p style={{ fontSize: '13px', color: '#A3A3A3' }}>Searching...</p>
          ) : memberResults.length === 0 && memberQuery.trim().length >= 3 ? (
            <p style={{ fontSize: '13px', color: '#A3A3A3' }}>No users found</p>
          ) : (
            memberResults.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #F5F5F5' }}>
                <Avatar src={u.avatar_url} name={u.display_name} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '14px', fontWeight: '600' }}>{u.display_name}</p>
                  <p style={{ fontSize: '12px', color: '#A3A3A3' }}>@{u.username}</p>
                </div>
                <button
                  onClick={() => handleAddMember(u.id)}
                  disabled={adding === u.id}
                  style={{
                    padding: '6px 14px',
                    background: '#0a0a0a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '100px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {adding === u.id ? 'Adding...' : 'Add'}
                </button>
              </div>
            ))
          )}
        </div>
      </BottomSheet>

      <ConfirmSheet
        isOpen={confirmAction === 'leave'}
        onClose={() => setConfirmAction(null)}
        title="Leave group?"
        message={`You'll no longer receive messages from ${name}. You can be re-added by another member.`}
        confirmLabel="Leave group"
        confirmStyle="danger"
        onConfirm={handleLeaveGroup}
      />
      <ConfirmSheet
        isOpen={confirmAction === 'delete'}
        onClose={() => setConfirmAction(null)}
        title="Delete conversation?"
        message="This clears the conversation from your list and removes your message history. If they message you again, it will reappear as a fresh conversation."
        confirmLabel="Delete"
        confirmStyle="danger"
        onConfirm={handleDelete}
      />
      <ConfirmSheet
        isOpen={confirmAction === 'block'}
        onClose={() => setConfirmAction(null)}
        title={`Block ${name}?`}
        message="They won't be able to message you, and this conversation will be hidden."
        confirmLabel="Block"
        confirmStyle="danger"
        onConfirm={handleBlock}
      />
    </>
  )
}
