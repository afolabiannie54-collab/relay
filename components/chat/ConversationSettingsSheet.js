'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BottomSheet from '@/components/shared/BottomSheet'
import ConfirmSheet from '@/components/shared/ConfirmSheet'
import Avatar from '@/components/shared/Avatar'
import CopyUsernameButton from '@/components/profile/CopyUsernameButton'
import { hideConversation } from '@/actions/messages'
import { getMuteStatus, muteConversation, unmuteConversation } from '@/actions/conversations'
import { removeMember, promoteToAdmin, demoteAdmin, leaveGroup, deleteGroup, addMember, updateGroupInfo, uploadGroupAvatar } from '@/actions/groups'
import { blockUser } from '@/actions/blocks'
import { searchUsers } from '@/actions/users'
import { cache } from '@/lib/cache'

const MUTE_OPTIONS = [
  { label: '1 hour', hours: 1 },
  { label: '8 hours', hours: 8 },
  { label: '1 week', hours: 24 * 7 },
  { label: 'Forever', hours: null },
]

const GROUP_NAME_MAX = 50
const GROUP_DESCRIPTION_MAX = 200

function vibrate() {
  try { window.navigator.vibrate?.(10) } catch {}
}

// Single entry point for all conversation-level actions — opened by
// tapping the conversation header or its ℹ️ button. Bottom sheet on
// mobile, centered modal on desktop (both via BottomSheet). Search and
// pinned messages are already implemented inline in the conversation
// page itself; this sheet just closes and asks the parent to open them
// via callbacks, rather than duplicating that UI.
export default function ConversationSettingsSheet({
  isOpen,
  onClose,
  conversationId,
  isGroup,
  myRole,
  otherParticipant,
  isOnline,
  groupInfo,
  pinnedCount,
  onOpenSearch,
  onOpenPinned,
  onGroupChanged,
  onSelectMessages,
}) {
  const router = useRouter()
  const [muteStatus, setMuteStatus] = useState({ muted: false, mutedUntil: null })
  const [showMutePicker, setShowMutePicker] = useState(false)
  const [muting, setMuting] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  const [memberActionUser, setMemberActionUser] = useState(null)
  const [showAddMember, setShowAddMember] = useState(false)
  const [memberQuery, setMemberQuery] = useState('')
  const [memberResults, setMemberResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [acting, setActing] = useState(null)
  const [showEditGroup, setShowEditGroup] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAvatarFile, setEditAvatarFile] = useState(null)
  const [editAvatarPreview, setEditAvatarPreview] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState(null)

  useEffect(() => {
    if (!isOpen || !conversationId) return
    async function loadMute() {
      const cached = cache.get(`mute:${conversationId}`)
      if (cached) setMuteStatus(cached)
      const result = await getMuteStatus(conversationId)
      setMuteStatus(result)
      cache.set(`mute:${conversationId}`, result, 30000)
    }
    loadMute()
  }, [isOpen, conversationId])

  // Sub-sheets (add member, per-member actions, edit group) only close
  // visually when their own state flips false — closing the parent
  // sheet without backing out of one first left it reopening straight
  // into that sub-screen next time. Resetting all of them here means
  // the parent sheet always reopens on the main menu.
  useEffect(() => {
    if (isOpen) return
    setShowAddMember(false)
    setMemberActionUser(null)
    setShowEditGroup(false)
  }, [isOpen])

  const canManageGroup = ['owner', 'admin'].includes(myRole)
  const isOwner = myRole === 'owner'
  const name = isGroup ? groupInfo?.name : otherParticipant?.display_name

  const handleMute = async (hours) => {
    setMuting(true)
    const mutedUntil = hours ? Date.now() + hours * 3600000 : null
    const result = await muteConversation(conversationId, mutedUntil)
    if (!result.error) {
      const next = { muted: true, mutedUntil: mutedUntil ? new Date(mutedUntil).toISOString() : null }
      setMuteStatus(next)
      cache.set(`mute:${conversationId}`, next, 30000)
      setShowMutePicker(false)
    }
    setMuting(false)
  }

  const handleUnmute = async () => {
    setMuting(true)
    const result = await unmuteConversation(conversationId)
    if (!result.error) {
      setMuteStatus({ muted: false, mutedUntil: null })
      cache.invalidate(`mute:${conversationId}`)
    }
    setMuting(false)
  }

  const handleHide = async () => {
    vibrate()
    await hideConversation(conversationId)
    onClose?.()
    router.push('/chat')
  }

  const handleBlock = async () => {
    if (!otherParticipant) return
    await blockUser(otherParticipant.id)
    onClose?.()
    router.push('/chat')
  }

  const handleShareProfile = async () => {
    const url = `${window.location.origin}/u/${otherParticipant.username}`
    if (navigator.share) {
      try { await navigator.share({ url }); return } catch { /* fall through to copy */ }
    }
    try { await navigator.clipboard.writeText(url) } catch {}
  }

  const handleLeaveGroup = async () => {
    await leaveGroup(conversationId)
    window.dispatchEvent(new Event('relay:conversations-changed'))
    onClose?.()
    router.push('/chat')
  }

  const handleDeleteGroup = async () => {
    await deleteGroup(conversationId)
    window.dispatchEvent(new Event('relay:conversations-changed'))
    onClose?.()
    router.push('/chat')
  }

  const handleMemberSearch = async (q) => {
    setMemberQuery(q)
    if (q.trim().length < 3) { setMemberResults([]); return }
    setSearching(true)
    const result = await searchUsers(q)
    if (result.data) {
      const memberIds = groupInfo?.members?.map(m => m.user_id) || []
      setMemberResults(result.data.filter(u => !memberIds.includes(u.id)))
    }
    setSearching(false)
  }

  const handleAddMember = async (userId) => {
    setActing(userId)
    await addMember(conversationId, userId)
    setActing(null)
    setMemberQuery('')
    setMemberResults([])
    setShowAddMember(false)
    onGroupChanged?.()
  }

  const handleRemoveMember = async () => {
    if (!memberActionUser) return
    setActing(memberActionUser.user_id)
    await removeMember(conversationId, memberActionUser.user_id)
    setActing(null)
    setMemberActionUser(null)
    onGroupChanged?.()
  }

  const handlePromote = async (userId) => {
    setActing(userId)
    await promoteToAdmin(conversationId, userId)
    setActing(null)
    setMemberActionUser(null)
    onGroupChanged?.()
  }

  const handleDemote = async (userId) => {
    setActing(userId)
    await demoteAdmin(conversationId, userId)
    setActing(null)
    setMemberActionUser(null)
    onGroupChanged?.()
  }

  const openEditGroup = () => {
    setEditName(groupInfo?.name || '')
    setEditDescription(groupInfo?.description || '')
    setEditAvatarFile(null)
    setEditAvatarPreview(groupInfo?.avatar_url || null)
    setEditError(null)
    setShowEditGroup(true)
  }

  const handleEditAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setEditAvatarFile(file)
    setEditAvatarPreview(URL.createObjectURL(file))
  }

  const handleSaveGroupEdit = async () => {
    if (!editName.trim()) { setEditError('Group name is required'); return }
    setEditSaving(true)
    setEditError(null)

    const data = new FormData()
    data.append('name', editName.trim().slice(0, GROUP_NAME_MAX))
    data.append('description', editDescription.trim().slice(0, GROUP_DESCRIPTION_MAX))
    const result = await updateGroupInfo(conversationId, data)
    if (result.error) {
      setEditError(result.error)
      setEditSaving(false)
      return
    }

    if (editAvatarFile) {
      const avatarData = new FormData()
      avatarData.append('avatar', editAvatarFile)
      await uploadGroupAvatar(conversationId, avatarData)
    }

    setEditSaving(false)
    setShowEditGroup(false)
    onGroupChanged?.()
  }

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    borderBottom: '1px solid #F5F5F5',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    borderBottomWidth: '1px',
    width: '100%',
    textAlign: 'left',
    fontFamily: 'inherit',
    fontSize: '14px',
    fontWeight: '500',
    color: '#0a0a0a',
  }

  const getRoleBadge = (role) => {
    if (role === 'owner') return <span style={{ padding: '2px 8px', background: '#FFB800', border: '1px solid #0a0a0a', borderRadius: '100px', fontSize: '10px', fontWeight: '700' }}>Owner</span>
    if (role === 'admin') return <span style={{ padding: '2px 8px', background: '#F5F5F5', border: '1px solid #0a0a0a', borderRadius: '100px', fontSize: '10px', fontWeight: '700' }}>Admin</span>
    return null
  }

  return (
    <>
      <BottomSheet isOpen={isOpen} onClose={onClose} title={isGroup ? 'Group info' : 'Conversation info'}>
        <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
          {/* Identity card */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px', borderBottom: '1px solid #E5E5E5' }}>
            <Avatar src={isGroup ? groupInfo?.avatar_url : otherParticipant?.avatar_url} name={name} size={72} />
            <p style={{ fontSize: '18px', fontWeight: '800', color: '#0a0a0a', marginTop: '12px' }}>{name}</p>
            {isGroup ? (
              <p style={{ fontSize: '13px', color: '#A3A3A3', marginTop: '2px' }}>{groupInfo?.members?.length || 0} members</p>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  <p style={{ fontSize: '13px', color: '#A3A3A3' }}>@{otherParticipant?.username}</p>
                  <CopyUsernameButton username={otherParticipant?.username} />
                </div>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>
                  {isOnline
                    ? <span style={{ color: '#22C55E' }}>● Online</span>
                    : <span style={{ color: '#A3A3A3' }}>Offline</span>}
                </p>
              </>
            )}
          </div>

          {/* Mute */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F5F5F5', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '14px', fontWeight: '600' }}>Notifications</p>
                <p style={{ fontSize: '12px', color: '#A3A3A3' }}>
                  {muteStatus.muted
                    ? muteStatus.mutedUntil ? `Muted until ${new Date(muteStatus.mutedUntil).toLocaleString()}` : 'Muted forever'
                    : 'Notifications are on'}
                </p>
              </div>
              {muteStatus.muted ? (
                <button onClick={handleUnmute} disabled={muting} style={{ padding: '8px 16px', background: '#fff', border: '1.5px solid #0a0a0a', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Unmute
                </button>
              ) : (
                <button onClick={() => setShowMutePicker(v => !v)} style={{ padding: '8px 16px', background: '#0a0a0a', color: '#fff', border: '1.5px solid #0a0a0a', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Mute
                </button>
              )}
            </div>
            {showMutePicker && (
              <div style={{ marginTop: '10px', border: '1.5px solid #0a0a0a', borderRadius: '10px', overflow: 'hidden' }}>
                {MUTE_OPTIONS.map(opt => (
                  <button
                    key={opt.label}
                    disabled={muting}
                    onClick={() => handleMute(opt.hours)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid #F5F5F5', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pinned + search */}
          <button style={rowStyle} onClick={() => { onClose?.(); onOpenPinned?.() }}>
            <span>📌 Pinned messages</span>
            <span style={{ color: '#A3A3A3' }}>{pinnedCount} →</span>
          </button>
          <button style={rowStyle} onClick={() => { onClose?.(); onOpenSearch?.() }}>
            <span>🔍 Search in conversation</span>
            <span style={{ color: '#A3A3A3' }}>→</span>
          </button>
          <button style={rowStyle} onClick={() => { onClose?.(); onSelectMessages?.() }}>
            <span>☑️ Select messages</span>
          </button>

          {isGroup ? (
            <>
              {/* Members */}
              <div style={{ padding: '16px 20px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <p style={{ fontSize: '13px', fontWeight: '700', color: '#A3A3A3', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Members ({groupInfo?.members?.length || 0})
                  </p>
                  {canManageGroup && (
                    <button onClick={() => setShowAddMember(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: '#0a0a0a', fontFamily: 'inherit' }}>
                      + Add
                    </button>
                  )}
                </div>
              </div>
              <div style={{ maxHeight: '240px', overflowY: 'auto', borderBottom: '1px solid #F5F5F5' }}>
                {groupInfo?.members?.map(member => (
                  <div
                    key={member.user_id}
                    onClick={() => setMemberActionUser(member)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 20px', cursor: 'pointer' }}
                  >
                    <Avatar src={member.avatar_url} name={member.display_name} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <p style={{ fontSize: '14px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.display_name}</p>
                        {getRoleBadge(member.role)}
                      </div>
                      <p style={{ fontSize: '12px', color: '#A3A3A3' }}>@{member.username}</p>
                    </div>
                  </div>
                ))}
              </div>

              {canManageGroup && (
                <button style={rowStyle} onClick={openEditGroup}>
                  <span>✏️ Edit group</span>
                  <span style={{ color: '#A3A3A3' }}>→</span>
                </button>
              )}
              <button style={{ ...rowStyle, color: '#EF4444' }} onClick={() => setConfirmAction('leave')}>
                <span>🚪 Leave group</span>
              </button>
              {isOwner && (
                <button style={{ ...rowStyle, color: '#EF4444', borderBottom: 'none' }} onClick={() => setConfirmAction('deleteGroup')}>
                  <span>🗑️ Delete group</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button style={rowStyle} onClick={() => { onClose?.(); router.push(`/u/${otherParticipant?.username}?from=conversation-settings&convId=${conversationId}`) }}>
                <span>View profile</span>
                <span style={{ color: '#A3A3A3' }}>→</span>
              </button>
              <button style={rowStyle} onClick={handleShareProfile}>
                <span>Share profile</span>
              </button>
              <button style={{ ...rowStyle, color: '#EF4444' }} onClick={() => setConfirmAction('block')}>
                <span>Block user</span>
              </button>
              <button style={{ ...rowStyle, color: '#EF4444', borderBottom: 'none' }} onClick={handleHide}>
                <span>Hide conversation</span>
              </button>
            </>
          )}
        </div>
      </BottomSheet>

      {/* Add member */}
      <BottomSheet isOpen={showAddMember} onClose={() => setShowAddMember(false)} title="Add member">
        <div style={{ padding: '12px 20px 20px', fontFamily: "'Inter', -apple-system, sans-serif" }}>
          <input
            type="text"
            value={memberQuery}
            onChange={e => handleMemberSearch(e.target.value)}
            placeholder="Search by username..."
            style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #E5E5E5', borderRadius: '10px', fontSize: '16px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }}
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
                  disabled={acting === u.id}
                  style={{ padding: '6px 14px', background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: '100px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {acting === u.id ? 'Adding...' : 'Add'}
                </button>
              </div>
            ))
          )}
        </div>
      </BottomSheet>

      {/* Edit group — inline sub-sheet, not a navigation to
          /groups/[id]/settings (that page still exists for deep-linking,
          but this is now the primary entry point). */}
      <BottomSheet isOpen={showEditGroup} onClose={() => setShowEditGroup(false)} title="Edit group">
        <div style={{ padding: '4px 20px 20px', fontFamily: "'Inter', -apple-system, sans-serif" }}>
          {editError && (
            <div style={{ background: '#FEF2F2', border: '1.5px solid #EF4444', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#EF4444' }}>
              {editError}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <label style={{ cursor: 'pointer', position: 'relative' }}>
              <input type="file" accept="image/*" onChange={handleEditAvatarChange} style={{ display: 'none' }} />
              <Avatar src={editAvatarPreview} name={editName} size={80} />
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                width: '26px', height: '26px', borderRadius: '50%',
                background: '#0a0a0a', color: '#fff', border: '1.5px solid #fff',
                fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                📷
              </div>
            </label>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Group name</label>
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value.slice(0, GROUP_NAME_MAX))}
              maxLength={GROUP_NAME_MAX}
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E5E5E5', borderRadius: '8px', fontSize: '16px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
            />
            {editName.length >= GROUP_NAME_MAX - 10 && (
              <p style={{ fontSize: '11px', color: editName.length >= GROUP_NAME_MAX ? '#EF4444' : '#A3A3A3', textAlign: 'right', marginTop: '4px' }}>
                {editName.length}/{GROUP_NAME_MAX}
              </p>
            )}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Description</label>
            <input
              type="text"
              value={editDescription}
              onChange={e => setEditDescription(e.target.value.slice(0, GROUP_DESCRIPTION_MAX))}
              placeholder="Optional"
              maxLength={GROUP_DESCRIPTION_MAX}
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E5E5E5', borderRadius: '8px', fontSize: '16px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
            />
            {editDescription.length >= GROUP_DESCRIPTION_MAX - 20 && (
              <p style={{ fontSize: '11px', color: editDescription.length >= GROUP_DESCRIPTION_MAX ? '#EF4444' : '#A3A3A3', textAlign: 'right', marginTop: '4px' }}>
                {editDescription.length}/{GROUP_DESCRIPTION_MAX}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setShowEditGroup(false)}
              disabled={editSaving}
              style={{ flex: 1, padding: '12px', background: '#fff', color: '#0a0a0a', border: '1.5px solid #0a0a0a', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveGroupEdit}
              disabled={editSaving || !editName.trim()}
              style={{ flex: 1, padding: '12px', background: editName.trim() ? '#0a0a0a' : '#E5E5E5', color: editName.trim() ? '#fff' : '#A3A3A3', border: '1.5px solid #0a0a0a', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: editName.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', boxShadow: editName.trim() ? '2px 2px 0 #FFB800' : 'none' }}
            >
              {editSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Per-member action sheet */}
      <BottomSheet isOpen={!!memberActionUser} onClose={() => setMemberActionUser(null)}>
        <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 20px 16px', borderBottom: '1px solid #E5E5E5' }}>
            <Avatar src={memberActionUser?.avatar_url} name={memberActionUser?.display_name} size={40} />
            <p style={{ fontSize: '15px', fontWeight: '800' }}>{memberActionUser?.display_name}</p>
          </div>
          <div style={{ padding: '8px 0' }}>
            <button
              style={rowStyle}
              onClick={() => { const u = memberActionUser?.username; setMemberActionUser(null); onClose?.(); router.push(`/u/${u}?from=conversation-settings&convId=${conversationId}`) }}
            >
              <span>View profile</span>
            </button>
            {isOwner && memberActionUser?.role === 'member' && (
              <button style={rowStyle} onClick={() => handlePromote(memberActionUser.user_id)}>
                <span>Promote to admin</span>
              </button>
            )}
            {isOwner && memberActionUser?.role === 'admin' && (
              <button style={rowStyle} onClick={() => handleDemote(memberActionUser.user_id)}>
                <span>Demote to member</span>
              </button>
            )}
            {canManageGroup && memberActionUser?.role !== 'owner' && (
              <button style={{ ...rowStyle, color: '#EF4444', borderBottom: 'none' }} onClick={handleRemoveMember}>
                <span>Remove from group</span>
              </button>
            )}
          </div>
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
        isOpen={confirmAction === 'deleteGroup'}
        onClose={() => setConfirmAction(null)}
        title="Delete group?"
        message="This permanently deletes the group for everyone. This cannot be undone."
        confirmLabel="Delete group"
        confirmStyle="danger"
        onConfirm={handleDeleteGroup}
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
