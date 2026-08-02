'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  Bell, BellOff, CheckCheck, Circle, EyeOff, Eye, UserPlus, DoorOpen,
  Trash2, UserX,
} from 'lucide-react'
import BottomSheet from '@/components/shared/BottomSheet'
import ConfirmSheet from '@/components/shared/ConfirmSheet'
import Avatar from '@/components/shared/Avatar'
import { muteConversation, unmuteConversation, deleteConversationForUser } from '@/actions/conversations'
import { markConversationRead, markConversationUnread, hideConversation, unhideConversation } from '@/actions/messages'
import { leaveGroup, addMember } from '@/actions/groups'
import { blockUser } from '@/actions/blocks'
import { searchUsers } from '@/actions/users'
import { cache } from '@/lib/cache'

const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

function vibrate() {
  try { window.navigator.vibrate?.(10) } catch {}
}

const rowStyle = {
  padding: '14px 20px',
  fontSize: '14px',
  fontWeight: '600',
  color: 'var(--text)',
  borderRadius: 0,
}

// Every row shares this shape: an icon/spinner, a label, disabled +
// dimmed while any action anywhere in this sheet is pending. Kept at
// module scope (rather than a closure inside the sheet component) so
// it isn't torn down and recreated — with its own local state, if it
// ever grows any — on every render of the parent.
function Row({ id, icon, label, onClick, danger, pending }) {
  return (
    <button
      className="relay-menu-row"
      style={{ ...rowStyle, ...(danger ? { color: 'var(--error)' } : {}) }}
      onClick={onClick}
      disabled={!!pending}
    >
      {pending === id ? <Spinner /> : icon}
      <span>{pending === id ? `${label}...` : label}</span>
    </button>
  )
}

function Spinner({ size = 14 }) {
  return (
    <div style={{
      width: size,
      height: size,
      border: '2px solid var(--border)',
      borderTopColor: 'var(--text-secondary)',
      borderRadius: '50%',
      animation: 'relay-cas-spin 0.7s linear infinite',
      flexShrink: 0,
    }}>
      <style>{`@keyframes relay-cas-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
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
  // Which row's mutation is currently in flight — every row disables
  // itself while any single one is pending (avoids double-taps landing
  // two conflicting actions, e.g. mute + hide at once) and the active
  // row swaps its own label/icon for a spinner so a tap always visibly
  // registers instead of leaving the sheet sitting there unchanged
  // until it suddenly closes.
  const [pending, setPending] = useState(null)

  if (!conversation) return null

  // Only leave the current screen if the conversation this row belongs to
  // is the one actually open in the detail pane — otherwise (e.g. acting
  // on a different row from the desktop two-panel list) this would yank
  // the user out of an unrelated conversation they still have open.
  const currentConversationId = pathname.startsWith('/chat/') ? pathname.split('/')[2] : null
  const isCurrentlyOpen = conversation.conversation_id === currentConversationId

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
    setPending(null)
    onClose?.()
  }

  const handleToggleMute = async () => {
    vibrate()
    setPending('mute')
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
    setPending('read')
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
    setPending('hide')
    await hideConversation(conversation.conversation_id)
    onChanged?.()
    // replace, not push — a hidden/deleted/left conversation's URL
    // shouldn't remain a valid back-navigation target in history.
    if (isCurrentlyOpen) router.replace('/chat')
    close()
  }

  const handleUnhide = async () => {
    vibrate()
    setPending('unhide')
    await unhideConversation(conversation.conversation_id)
    onChanged?.()
    close()
  }

  // delete/leave/block are only ever reached through their ConfirmSheet
  // (the row itself just opens that), which already owns its own
  // "Please wait…" pending state on the confirm button — no need to
  // duplicate it here since this sheet's own menu is covered by that
  // point anyway.
  const handleDelete = async () => {
    await deleteConversationForUser(conversation.conversation_id)
    // A stale cached page of messages (from before the deletion cutoff)
    // would otherwise serve the full unfiltered history on next open,
    // since getMessages()'s deleted_at filter only ever runs on an
    // actual server fetch, not a cache hit.
    cache.invalidate(`messages:${conversation.conversation_id}`)
    onChanged?.()
    if (isCurrentlyOpen) router.replace('/chat')
    close()
  }

  const handleLeaveGroup = async () => {
    await leaveGroup(conversation.conversation_id)
    onChanged?.()
    if (isCurrentlyOpen) router.replace('/chat')
    close()
  }

  const handleBlock = async () => {
    if (!otherUser) return
    await blockUser(otherUser.user_id)
    onChanged?.()
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

  return (
    <>
      <BottomSheet isOpen={isOpen && mode === 'menu'} onClose={close}>
        <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 20px 16px', borderBottom: '1px solid var(--border-light)' }}>
            <Avatar src={avatarUrl} name={name} size={40} />
            <p style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
          </div>

          <div style={{ padding: '8px 0' }}>
            {isHidden ? (
              <>
                <Row id="unhide" icon={<Eye size={17} {...iconProps} />} label="Unhide" onClick={handleUnhide} pending={pending} />
                <Row id="delete" icon={<Trash2 size={17} {...iconProps} />} label="Delete conversation" onClick={() => setConfirmAction('delete')} danger pending={pending} />
                {!isGroup && (
                  <Row id="block" icon={<UserX size={17} {...iconProps} />} label="Block user" onClick={() => setConfirmAction('block')} danger pending={pending} />
                )}
              </>
            ) : (
              <>
                <Row id="mute" icon={isMuted ? <Bell size={17} {...iconProps} /> : <BellOff size={17} {...iconProps} />} label={isMuted ? 'Unmute' : 'Mute'} onClick={handleToggleMute} pending={pending} />
                <Row id="read" icon={isUnread ? <CheckCheck size={17} {...iconProps} /> : <Circle size={17} {...iconProps} />} label={isUnread ? 'Mark as read' : 'Mark as unread'} onClick={handleToggleRead} pending={pending} />
                <Row id="hide" icon={<EyeOff size={17} {...iconProps} />} label="Hide conversation" onClick={handleHide} pending={pending} />

                {isGroup ? (
                  <>
                    {canManageGroup && (
                      <Row id="addMember" icon={<UserPlus size={17} {...iconProps} />} label="Add member" onClick={() => setMode('addMember')} pending={pending} />
                    )}
                    <Row id="leave" icon={<DoorOpen size={17} {...iconProps} />} label="Leave group" onClick={() => setConfirmAction('leave')} danger pending={pending} />
                  </>
                ) : (
                  <>
                    <Row id="delete" icon={<Trash2 size={17} {...iconProps} />} label="Delete conversation" onClick={() => setConfirmAction('delete')} danger pending={pending} />
                    <Row id="block" icon={<UserX size={17} {...iconProps} />} label="Block user" onClick={() => setConfirmAction('block')} danger pending={pending} />
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
            className="relay-input"
            style={{ width: '100%', padding: '12px 14px', fontSize: '16px', boxSizing: 'border-box', marginBottom: '12px' }}
          />
          {searching ? (
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Searching...</p>
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
                  className="relay-btn relay-btn--filled"
                  onClick={() => handleAddMember(u.id)}
                  disabled={adding === u.id}
                  style={{ padding: '6px 14px', borderRadius: 'var(--radius-pill)', fontSize: '12px' }}
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
