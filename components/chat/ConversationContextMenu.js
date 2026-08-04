'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createPortal } from 'react-dom'
import { BellOff, Bell, Check, Circle, EyeOff, Eye, UserPlus, LogOut, Trash2, Ban } from 'lucide-react'
import BottomSheet from '@/components/shared/BottomSheet'
import ConfirmSheet from '@/components/shared/ConfirmSheet'
import Avatar from '@/components/shared/Avatar'
import { muteConversation, unmuteConversation, deleteConversationForUser } from '@/actions/conversations'
import { markConversationRead, markConversationUnread, hideConversation, unhideConversation } from '@/actions/messages'
import { leaveGroup, addMember } from '@/actions/groups'
import { blockUser } from '@/actions/blocks'
import { searchUsers } from '@/actions/users'
import { cache } from '@/lib/cache'

// Desktop right-click equivalent of ConversationActionSheet. `position`
// is {x, y} in viewport coordinates (from the contextmenu event) or null
// to stay closed. isHidden mirrors ConversationActionSheet's reduced
// menu for /chat/hidden: Unhide, Delete conversation, Block user (DM
// only).
export default function ConversationContextMenu({ conversation, isMuted, position, onClose, onChanged, isHidden = false }) {
  const router = useRouter()
  const pathname = usePathname()
  const [showAddMember, setShowAddMember] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  const [memberQuery, setMemberQuery] = useState('')
  const [memberResults, setMemberResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [addMemberFeedback, setAddMemberFeedback] = useState(null)
  const [adding, setAdding] = useState(null)

  useEffect(() => {
    if (!position) return
    const handleKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [position, onClose])

  // No separate "mounted" gate needed for the createPortal(document.body)
  // call below — `position` is always null until a contextmenu event sets
  // it client-side, so this already returns before ever touching `document`
  // during SSR.
  if (!position || !conversation) return null

  // Only leave the current screen if the conversation this row belongs to
  // is the one actually open in the detail pane — otherwise (right-clicking
  // a different row in the desktop two-panel list) this would yank the
  // user out of an unrelated conversation they still have open.
  const currentConversationId = pathname.startsWith('/chat/') ? pathname.split('/')[2] : null
  const isCurrentlyOpen = conversation.conversation_id === currentConversationId

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
    // replace, not push — a hidden/deleted/left conversation's URL
    // shouldn't remain a valid back-navigation target in history.
    if (isCurrentlyOpen) router.replace('/chat')
    onClose?.()
  }

  const handleUnhide = async () => {
    await unhideConversation(conversation.conversation_id)
    onChanged?.()
    onClose?.()
  }

  const handleDelete = async () => {
    const result = await deleteConversationForUser(conversation.conversation_id)
    if (result?.error) return result
    // A stale cached page of messages (from before the deletion cutoff)
    // would otherwise serve the full unfiltered history on next open,
    // since getMessages()'s deleted_at filter only ever runs on an
    // actual server fetch, not a cache hit.
    cache.invalidate(`messages:${conversation.conversation_id}`)
    onChanged?.()
    if (isCurrentlyOpen) router.replace('/chat')
    onClose?.()
    return result
  }

  const handleLeaveGroup = async () => {
    const result = await leaveGroup(conversation.conversation_id)
    if (result?.error) return result
    onChanged?.()
    if (isCurrentlyOpen) router.replace('/chat')
    onClose?.()
    return result
  }

  const handleBlock = async () => {
    if (!otherUser) return
    const result = await blockUser(otherUser.user_id)
    if (result?.error) return result
    onChanged?.()
    onClose?.()
    return result
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
    setAddMemberFeedback(null)
    const result = await addMember(conversation.conversation_id, userId)
    setAdding(null)

    if (result.error) {
      setAddMemberFeedback({ type: 'error', text: result.error })
      return
    }

    setMemberResults(prev => prev.filter(u => u.id !== userId))
    if (result.invited) {
      setAddMemberFeedback({ type: 'invited', text: 'Invite sent — they\'ll join once they accept it.' })
    }
    onChanged?.()
  }

  const rowStyle = { color: 'var(--text)' }
  const dangerRowStyle = { color: 'var(--error)' }

  // Clamp so the menu never renders off the right/bottom edge of the viewport.
  const menuWidth = 226
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
        className="relay-popover relay-context-menu"
        style={{
          position: 'fixed',
          left,
          top,
          width: menuWidth,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-popover)',
          zIndex: 1001,
          padding: '6px',
          fontFamily: "'Inter', -apple-system, sans-serif",
        }}
      >
        {isHidden ? (
          <>
            <button className="relay-menu-row" style={rowStyle} onClick={handleUnhide}><Eye size={15} strokeWidth={2.25} /> Unhide</button>
            <button className="relay-menu-row" style={dangerRowStyle} onClick={() => setConfirmAction('delete')}><Trash2 size={15} strokeWidth={2.25} /> Delete conversation</button>
            {!isGroup && (
              <button className="relay-menu-row" style={dangerRowStyle} onClick={() => setConfirmAction('block')}><Ban size={15} strokeWidth={2.25} /> Block user</button>
            )}
          </>
        ) : (
          <>
            <button className="relay-menu-row" style={rowStyle} onClick={handleToggleMute}>
              {isMuted ? <Bell size={15} strokeWidth={2.25} /> : <BellOff size={15} strokeWidth={2.25} />}
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
            <button className="relay-menu-row" style={rowStyle} onClick={handleToggleRead}>
              {isUnread ? <Check size={15} strokeWidth={2.25} /> : <Circle size={9} strokeWidth={2.25} fill="currentColor" style={{ marginInline: '3px' }} />}
              {isUnread ? 'Mark as read' : 'Mark as unread'}
            </button>
            <button className="relay-menu-row" style={rowStyle} onClick={handleHide}><EyeOff size={15} strokeWidth={2.25} /> Hide conversation</button>
            {isGroup ? (
              <>
                {canManageGroup && (
                  <button className="relay-menu-row" style={rowStyle} onClick={() => setShowAddMember(true)}><UserPlus size={15} strokeWidth={2.25} /> Add member</button>
                )}
                <button className="relay-menu-row" style={dangerRowStyle} onClick={() => setConfirmAction('leave')}><LogOut size={15} strokeWidth={2.25} /> Leave group</button>
              </>
            ) : (
              <>
                <button className="relay-menu-row" style={dangerRowStyle} onClick={() => setConfirmAction('delete')}><Trash2 size={15} strokeWidth={2.25} /> Delete conversation</button>
                <button className="relay-menu-row" style={dangerRowStyle} onClick={() => setConfirmAction('block')}><Ban size={15} strokeWidth={2.25} /> Block user</button>
              </>
            )}
          </>
        )}
      </div>

      <BottomSheet isOpen={showAddMember} onClose={() => { setShowAddMember(false); setAddMemberFeedback(null) }} title="Add member">
        <div style={{ padding: '12px 20px 20px', fontFamily: "'Inter', -apple-system, sans-serif" }}>
          {addMemberFeedback && (
            <div style={{
              padding: '10px 14px',
              marginBottom: '12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              background: addMemberFeedback.type === 'error' ? 'var(--error-light)' : 'var(--success-light)',
              border: `1.5px solid ${addMemberFeedback.type === 'error' ? 'var(--error)' : 'var(--success)'}`,
              color: addMemberFeedback.type === 'error' ? 'var(--error)' : 'var(--success)',
            }}>
              {addMemberFeedback.text}
            </div>
          )}
          <input
            type="text"
            value={memberQuery}
            onChange={e => handleMemberSearch(e.target.value)}
            placeholder="Search by username..."
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '16px',
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
              marginBottom: '12px',
              background: 'var(--bg-subtle)',
              color: 'var(--text)',
            }}
          />
          {searching ? (
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Searching…</p>
          ) : memberResults.length === 0 && memberQuery.trim().length >= 3 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>No users found</p>
          ) : (
            memberResults.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                <Avatar src={u.avatar_url} name={u.display_name} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>{u.display_name}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>@{u.username}</p>
                </div>
                <button
                  onClick={() => handleAddMember(u.id)}
                  disabled={adding === u.id}
                  style={{
                    padding: '6px 14px',
                    background: 'var(--text)',
                    color: 'var(--background)',
                    border: 'none',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    opacity: adding === u.id ? 0.6 : 1,
                  }}
                >
                  {adding === u.id ? 'Adding…' : 'Add'}
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
    </>,
    document.body
  )
}
