'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import BottomSheet from '@/components/shared/BottomSheet'
import ConfirmSheet from '@/components/shared/ConfirmSheet'
import Avatar from '@/components/shared/Avatar'
import { muteConversation, unmuteConversation, deleteConversationForUser } from '@/actions/conversations'
import { markConversationRead, markConversationUnread, hideConversation } from '@/actions/messages'
import { leaveGroup, addMember } from '@/actions/groups'
import { blockUser } from '@/actions/blocks'
import { searchUsers } from '@/actions/users'

// Desktop right-click equivalent of ConversationActionSheet. `position`
// is {x, y} in viewport coordinates (from the contextmenu event) or null
// to stay closed.
export default function ConversationContextMenu({ conversation, isMuted, position, onClose, onChanged }) {
  const [mounted, setMounted] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  const [memberQuery, setMemberQuery] = useState('')
  const [memberResults, setMemberResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!position) return
    const handleKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [position, onClose])

  if (!mounted || !position || !conversation) return null

  const isGroup = conversation.type === 'group'
  const otherUser = conversation.other_participants?.[0]
  const isUnread = (conversation.unread_count || 0) > 0
  const canManageGroup = ['owner', 'admin'].includes(conversation.role)
  const name = isGroup ? conversation.group_info?.name : otherUser?.display_name

  const handleToggleMute = async () => {
    if (isMuted) await unmuteConversation(conversation.conversation_id)
    else await muteConversation(conversation.conversation_id, null)
    onChanged?.()
    onClose?.()
  }

  const handleToggleRead = async () => {
    if (isUnread) await markConversationRead(conversation.conversation_id)
    else await markConversationUnread(conversation.conversation_id)
    onChanged?.()
    onClose?.()
  }

  const handleHide = async () => {
    await hideConversation(conversation.conversation_id)
    onChanged?.()
    onClose?.()
  }

  const handleDelete = async () => {
    await deleteConversationForUser(conversation.conversation_id)
    onChanged?.()
    onClose?.()
  }

  const handleLeaveGroup = async () => {
    await leaveGroup(conversation.conversation_id)
    onChanged?.()
    onClose?.()
  }

  const handleBlock = async () => {
    if (!otherUser) return
    await blockUser(otherUser.user_id)
    onChanged?.()
    onClose?.()
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
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '9px 14px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#0a0a0a',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  }

  // Clamp so the menu never renders off the right/bottom edge of the viewport.
  const menuWidth = 220
  const left = Math.min(position.x, window.innerWidth - menuWidth - 8)
  const top = Math.min(position.y, window.innerHeight - 260)

  return createPortal(
    <>
      <div
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose?.() }}
        style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
      />
      <div
        style={{
          position: 'fixed',
          left,
          top,
          width: menuWidth,
          background: '#fff',
          border: '1.5px solid #0a0a0a',
          borderRadius: '10px',
          boxShadow: '4px 4px 0 #0a0a0a',
          zIndex: 1001,
          padding: '6px 0',
          fontFamily: "'Inter', -apple-system, sans-serif",
        }}
      >
        <button style={rowStyle} onClick={handleToggleMute}>{isMuted ? '🔔 Unmute' : '🔕 Mute'}</button>
        <button style={rowStyle} onClick={handleToggleRead}>{isUnread ? '✓ Mark as read' : '● Mark as unread'}</button>
        <button style={rowStyle} onClick={handleHide}>🙈 Hide conversation</button>
        {isGroup ? (
          <>
            {canManageGroup && (
              <button style={rowStyle} onClick={() => setShowAddMember(true)}>➕ Add member</button>
            )}
            <button style={{ ...rowStyle, color: '#EF4444' }} onClick={() => setConfirmAction('leave')}>🚪 Leave group</button>
          </>
        ) : (
          <>
            <button style={{ ...rowStyle, color: '#EF4444' }} onClick={() => setConfirmAction('delete')}>🗑️ Delete conversation</button>
            <button style={{ ...rowStyle, color: '#EF4444' }} onClick={() => setConfirmAction('block')}>🚫 Block user</button>
          </>
        )}
      </div>

      <BottomSheet isOpen={showAddMember} onClose={() => setShowAddMember(false)} title="Add member">
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
        message="This removes the conversation from your list permanently. The other person's copy is not affected."
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
    </>,
    document.body
  )
}
