'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell, BellOff, Pin, Search, CheckSquare, ChevronRight, Pencil,
  DoorOpen, Trash2, User, Share2, UserX, EyeOff, UserPlus, Crown,
  ShieldCheck, ShieldOff, CheckCircle2, Camera,
} from 'lucide-react'
import BottomSheet from '@/components/shared/BottomSheet'
import ConfirmSheet from '@/components/shared/ConfirmSheet'
import Avatar from '@/components/shared/Avatar'
import CopyUsernameButton from '@/components/profile/CopyUsernameButton'
import { hideConversation } from '@/actions/messages'
import { getMuteStatus, muteConversation, unmuteConversation } from '@/actions/conversations'
import {
  removeMember, promoteToAdmin, demoteAdmin, leaveGroup, deleteGroup, addMember,
  transferOwnership, updateGroupInfo, uploadGroupAvatar,
} from '@/actions/groups'
import { blockUser } from '@/actions/blocks'
import { useProfileSheet } from '@/lib/profile-sheet-context'
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

const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

function vibrate() {
  try { window.navigator.vibrate?.(10) } catch {}
}

function formatLastSeen(lastSeen) {
  const date = new Date(lastSeen)
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

// Single entry point for all conversation-level actions — opened by
// tapping the conversation header or its info button. Bottom sheet on
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
  const { openProfile } = useProfileSheet()
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
  // Locally reflects role changes the instant an action succeeds, ahead
  // of onGroupChanged's server refetch — keyed by user_id, only ever
  // holds entries this sheet itself just changed.
  const [roleOverrides, setRoleOverrides] = useState({})
  // myRole is a prop from the parent's own conversation.role state, which
  // onGroupChanged (a groupInfo-only refetch) never touches — without
  // this, transferring ownership away would leave the ex-owner seeing
  // owner-only actions (Delete group, Make owner) for the rest of this
  // mount, since nothing else would tell this sheet their own role
  // changed until the whole conversation page next remounts.
  const [selfRoleOverride, setSelfRoleOverride] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [showEditGroup, setShowEditGroup] = useState(false)
  const [editFormData, setEditFormData] = useState({ name: '', description: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef(null)

  // groupInfo only exists once loaded, and this sheet can be opened
  // before that happens — seeding the form from the current values each
  // time the edit sub-sheet opens (rather than on every groupInfo
  // change) keeps an in-progress edit from being clobbered by an
  // unrelated onGroupChanged refetch firing while it's open.
  useEffect(() => {
    if (!showEditGroup) return
    setEditFormData({ name: groupInfo?.name || '', description: groupInfo?.description || '' })
    setEditError(null)
  }, [showEditGroup, groupInfo])

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

  // This component stays mounted across opens/closes for the same
  // conversation (only the isOpen prop toggles), so without this,
  // reopening it could flash straight into a stale confirmation dialog
  // or an already-expanded mute picker left over from a previous open —
  // e.g. pressing Escape while a stacked ConfirmSheet is open closes both
  // sheets at once, leaving confirmAction set for whenever this reopens.
  // selfRoleOverride is deliberately NOT reset here — it needs to survive
  // closes/reopens within the same mount since myRole itself won't
  // correct until the page remounts (see comment above).
  useEffect(() => {
    if (isOpen) return
    setConfirmAction(null)
    setShowMutePicker(false)
    setShowAddMember(false)
    setShowEditGroup(false)
    setSuccessMessage(null)
  }, [isOpen])

  const effectiveRole = selfRoleOverride ?? myRole
  const canManageGroup = ['owner', 'admin'].includes(effectiveRole)
  const isOwner = effectiveRole === 'owner'
  const name = isGroup ? groupInfo?.name : otherParticipant?.display_name

  const getMemberRole = (member) => roleOverrides[member.user_id] ?? member.role

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
    // replace, not push — a hidden/deleted/left conversation's URL
    // shouldn't remain a valid back-navigation target in history.
    router.replace('/chat')
  }

  const handleBlock = async () => {
    if (!otherParticipant) return
    await blockUser(otherParticipant.id)
    // Same signal ConversationActionSheet/ConversationContextMenu's own
    // block handlers already fire — without it, ChatList (which stays
    // mounted across this navigation) wouldn't know to drop the now-
    // hidden conversation from its list until some later, unrelated
    // trigger refreshed it.
    window.dispatchEvent(new Event('relay:conversations-changed'))
    onClose?.()
    router.replace('/chat')
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
    router.replace('/chat')
  }

  const handleDeleteGroup = async () => {
    await deleteGroup(conversationId)
    window.dispatchEvent(new Event('relay:conversations-changed'))
    onClose?.()
    router.replace('/chat')
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

  const editIsDirty = editFormData.name !== (groupInfo?.name || '') || editFormData.description !== (groupInfo?.description || '')

  const handleSaveGroupInfo = async () => {
    setEditSaving(true)
    setEditError(null)
    const data = new FormData()
    data.append('name', editFormData.name.trim().slice(0, GROUP_NAME_MAX))
    data.append('description', editFormData.description.trim().slice(0, GROUP_DESCRIPTION_MAX))
    const result = await updateGroupInfo(conversationId, data)
    if (result.error) setEditError(result.error)
    else onGroupChanged?.()
    setEditSaving(false)
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    const data = new FormData()
    data.append('avatar', file)
    const result = await uploadGroupAvatar(conversationId, data)
    if (result.error) setEditError(result.error)
    else onGroupChanged?.()
    setAvatarUploading(false)
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

  const handleTransferOwnership = async () => {
    if (!memberActionUser) return
    const targetId = memberActionUser.user_id
    const targetName = memberActionUser.display_name
    // The only member with role 'owner' right now is whoever is looking
    // at this option at all (it's only rendered for the current owner),
    // so this is how the sheet finds "my own" member row without needing
    // a separate current-user-id prop threaded in just for this.
    const currentOwner = groupInfo?.members?.find(m => getMemberRole(m) === 'owner')

    setActing(targetId)
    const result = await transferOwnership(conversationId, targetId)
    setActing(null)
    setMemberActionUser(null)

    if (result.error) return

    setRoleOverrides(prev => {
      const next = { ...prev, [targetId]: 'owner' }
      if (currentOwner) next[currentOwner.user_id] = 'admin'
      return next
    })
    setSelfRoleOverride('admin')
    setSuccessMessage(`${targetName} is now the group owner`)
    setTimeout(() => setSuccessMessage(null), 2500)
    onGroupChanged?.()
  }

  const rowStyle = {
    padding: '14px 20px',
    borderBottom: '1px solid var(--border-light)',
    borderRadius: 0,
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text)',
  }

  const getRoleBadge = (role) => {
    if (role === 'owner') return <span style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 8px', background: 'var(--accent)', border: '1.5px solid var(--border-strong)', borderRadius: 'var(--radius-pill)', fontSize: '10px', fontWeight: '700', color: 'var(--foreground)' }}><Crown size={10} {...iconProps} /> Owner</span>
    if (role === 'admin') return <span style={{ padding: '2px 8px', background: 'var(--gray-100)', border: '1.5px solid var(--border-strong)', borderRadius: 'var(--radius-pill)', fontSize: '10px', fontWeight: '700', color: 'var(--text)' }}>Admin</span>
    return null
  }

  return (
    <>
      <BottomSheet isOpen={isOpen} onClose={onClose} title={isGroup ? 'Group info' : 'Conversation info'}>
        <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
          {successMessage && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border-light)', fontSize: '13px', color: 'var(--success)', fontWeight: '700', textAlign: 'center' }}>
              <CheckCircle2 size={15} {...iconProps} /> {successMessage}
            </div>
          )}
          {/* Identity card */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px', borderBottom: '2px solid var(--border-strong)' }}>
            <Avatar src={isGroup ? groupInfo?.avatar_url : otherParticipant?.avatar_url} name={name} size={72} />
            <p style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', marginTop: '12px' }}>{name}</p>
            {isGroup ? (
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{groupInfo?.members?.length || 0} members</p>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>@{otherParticipant?.username}</p>
                  <CopyUsernameButton username={otherParticipant?.username} />
                </div>
                {isOnline && otherParticipant?.show_online_status ? (
                  <p style={{ fontSize: '12px', marginTop: '4px', color: 'var(--success)', fontWeight: '600' }}>
                    ● Online
                  </p>
                ) : otherParticipant?.show_last_seen && otherParticipant?.last_seen ? (
                  <p style={{ fontSize: '12px', marginTop: '4px', color: 'var(--text-tertiary)' }}>
                    Last seen {formatLastSeen(otherParticipant.last_seen)}
                  </p>
                ) : null}
              </>
            )}
          </div>

          {/* Mute */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-light)', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {muteStatus.muted ? <BellOff size={18} {...iconProps} color="var(--text-secondary)" /> : <Bell size={18} {...iconProps} color="var(--text-secondary)" />}
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>Notifications</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                    {muteStatus.muted
                      ? muteStatus.mutedUntil ? `Muted until ${new Date(muteStatus.mutedUntil).toLocaleString()}` : 'Muted forever'
                      : 'Notifications are on'}
                  </p>
                </div>
              </div>
              {muteStatus.muted ? (
                <button className="relay-btn" onClick={handleUnmute} disabled={muting}>
                  Unmute
                </button>
              ) : (
                <button className="relay-btn relay-btn--filled" onClick={() => setShowMutePicker(v => !v)}>
                  Mute
                </button>
              )}
            </div>
            {showMutePicker && (
              <div style={{ marginTop: '10px', border: '2px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                {MUTE_OPTIONS.map(opt => (
                  <button
                    key={opt.label}
                    disabled={muting}
                    onClick={() => handleMute(opt.hours)}
                    className="relay-menu-row"
                    style={{ borderRadius: 0, borderBottom: '1px solid var(--border-light)', fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pinned + search */}
          <button className="relay-menu-row" style={rowStyle} onClick={() => { onClose?.(); onOpenPinned?.() }}>
            <Pin size={17} {...iconProps} />
            <span style={{ flex: 1 }}>Pinned messages</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: 'var(--text-tertiary)', fontWeight: '600' }}>{pinnedCount} <ChevronRight size={15} {...iconProps} /></span>
          </button>
          <button className="relay-menu-row" style={rowStyle} onClick={() => { onClose?.(); onOpenSearch?.() }}>
            <Search size={17} {...iconProps} />
            <span style={{ flex: 1 }}>Search in conversation</span>
            <ChevronRight size={15} {...iconProps} color="var(--text-tertiary)" />
          </button>
          <button className="relay-menu-row" style={rowStyle} onClick={() => { onClose?.(); onSelectMessages?.() }}>
            <CheckSquare size={17} {...iconProps} />
            <span style={{ flex: 1 }}>Select messages</span>
          </button>

          {isGroup ? (
            <>
              {/* Members */}
              <div style={{ padding: '16px 20px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Members ({groupInfo?.members?.length || 0})
                  </p>
                  {canManageGroup && (
                    <button onClick={() => setShowAddMember(true)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: 'var(--text)', fontFamily: 'inherit' }}>
                      <UserPlus size={15} {...iconProps} /> Add
                    </button>
                  )}
                </div>
              </div>
              <div style={{ maxHeight: '240px', overflowY: 'auto', borderBottom: '1px solid var(--border-light)' }}>
                {groupInfo?.members?.map(member => {
                  const role = getMemberRole(member)
                  return (
                    <button
                      key={member.user_id}
                      onClick={() => setMemberActionUser({ ...member, role })}
                      className="relay-menu-row"
                      style={{ borderRadius: 0, padding: '10px 20px' }}
                    >
                      <Avatar src={member.avatar_url} name={member.display_name} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.display_name}</p>
                          {getRoleBadge(role)}
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>@{member.username}</p>
                      </div>
                    </button>
                  )
                })}
              </div>

              {canManageGroup && (
                <button className="relay-menu-row" style={rowStyle} onClick={() => setShowEditGroup(true)}>
                  <Pencil size={17} {...iconProps} />
                  <span style={{ flex: 1 }}>Edit group</span>
                  <ChevronRight size={15} {...iconProps} color="var(--text-tertiary)" />
                </button>
              )}
              {isOwner ? (
                <div style={{ ...rowStyle, display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-tertiary)', cursor: 'default' }}>
                  <DoorOpen size={17} {...iconProps} />
                  <span>Transfer ownership before leaving</span>
                </div>
              ) : (
                <button className="relay-menu-row" style={{ ...rowStyle, color: 'var(--error)' }} onClick={() => setConfirmAction('leave')}>
                  <DoorOpen size={17} {...iconProps} />
                  <span>Leave group</span>
                </button>
              )}
              {isOwner && (
                <button className="relay-menu-row" style={{ ...rowStyle, color: 'var(--error)', borderBottom: 'none' }} onClick={() => setConfirmAction('deleteGroup')}>
                  <Trash2 size={17} {...iconProps} />
                  <span>Delete group</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button className="relay-menu-row" style={rowStyle} onClick={() => { onClose?.(); openProfile(otherParticipant?.username) }}>
                <User size={17} {...iconProps} />
                <span style={{ flex: 1 }}>View profile</span>
                <ChevronRight size={15} {...iconProps} color="var(--text-tertiary)" />
              </button>
              <button className="relay-menu-row" style={rowStyle} onClick={handleShareProfile}>
                <Share2 size={17} {...iconProps} />
                <span>Share profile</span>
              </button>
              <button className="relay-menu-row" style={{ ...rowStyle, color: 'var(--error)' }} onClick={() => setConfirmAction('block')}>
                <UserX size={17} {...iconProps} />
                <span>Block user</span>
              </button>
              <button className="relay-menu-row" style={{ ...rowStyle, color: 'var(--error)', borderBottom: 'none' }} onClick={handleHide}>
                <EyeOff size={17} {...iconProps} />
                <span>Hide conversation</span>
              </button>
            </>
          )}
        </div>
      </BottomSheet>

      {/* Edit group — folded in from the old standalone /groups/[id]/settings
          route. Everything else that page did (mute, members, leave,
          delete) already lived here too; this sub-sheet only needs to
          own what was actually unique to it: avatar, name, description. */}
      <BottomSheet isOpen={showEditGroup} onClose={() => setShowEditGroup(false)} title="Edit group">
        <div style={{ padding: '16px 20px 20px', fontFamily: "'Inter', -apple-system, sans-serif" }}>
          {editError && (
            <div style={{ background: 'var(--error-light)', border: '1.5px solid var(--error)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: 'var(--error)' }}>
              {editError}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <div style={{ position: 'relative' }}>
              <Avatar src={groupInfo?.avatar_url} name={groupInfo?.name} size={64} />
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                aria-label="Change group photo"
                className="relay-icon-btn"
                style={{
                  position: 'absolute', bottom: '-4px', right: '-4px',
                  width: '28px', height: '28px', borderRadius: 'var(--radius-pill)',
                  background: 'var(--text)', color: 'var(--background)',
                }}
              >
                <Camera size={13} {...iconProps} />
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
            </div>
            <div>
              <p style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text)' }}>{groupInfo?.name}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{groupInfo?.members?.length || 0} members</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)', display: 'block', marginBottom: '6px' }}>Name</label>
              <input
                type="text"
                value={editFormData.name}
                onChange={e => setEditFormData(prev => ({ ...prev, name: e.target.value.slice(0, GROUP_NAME_MAX) }))}
                maxLength={GROUP_NAME_MAX}
                className="relay-input"
                style={{ width: '100%', padding: '10px 12px', fontSize: '16px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)', display: 'block', marginBottom: '6px' }}>Description</label>
              <input
                type="text"
                value={editFormData.description}
                onChange={e => setEditFormData(prev => ({ ...prev, description: e.target.value.slice(0, GROUP_DESCRIPTION_MAX) }))}
                placeholder="Optional"
                maxLength={GROUP_DESCRIPTION_MAX}
                className="relay-input"
                style={{ width: '100%', padding: '10px 12px', fontSize: '16px', boxSizing: 'border-box' }}
              />
            </div>
            <button
              className="relay-btn relay-btn--filled"
              onClick={handleSaveGroupInfo}
              disabled={editSaving || !editIsDirty || !editFormData.name.trim()}
              style={{ padding: '10px' }}
            >
              {editSaving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
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
                  disabled={acting === u.id}
                  style={{ padding: '6px 14px', borderRadius: 'var(--radius-pill)', fontSize: '12px' }}
                >
                  {acting === u.id ? 'Adding...' : 'Add'}
                </button>
              </div>
            ))
          )}
        </div>
      </BottomSheet>

      {/* Per-member action sheet */}
      <BottomSheet isOpen={!!memberActionUser} onClose={() => setMemberActionUser(null)}>
        <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 20px 16px', borderBottom: '1px solid var(--border-light)' }}>
            <Avatar src={memberActionUser?.avatar_url} name={memberActionUser?.display_name} size={40} />
            <p style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>{memberActionUser?.display_name}</p>
          </div>
          <div style={{ padding: '8px 0' }}>
            <button
              className="relay-menu-row"
              style={rowStyle}
              onClick={() => { const u = memberActionUser?.username; setMemberActionUser(null); onClose?.(); openProfile(u) }}
            >
              <User size={17} {...iconProps} />
              <span>View profile</span>
            </button>
            {isOwner && memberActionUser?.role === 'member' && (
              <button className="relay-menu-row" style={rowStyle} onClick={() => handlePromote(memberActionUser.user_id)}>
                <ShieldCheck size={17} {...iconProps} />
                <span>Promote to admin</span>
              </button>
            )}
            {isOwner && memberActionUser?.role === 'admin' && (
              <button className="relay-menu-row" style={rowStyle} onClick={() => handleDemote(memberActionUser.user_id)}>
                <ShieldOff size={17} {...iconProps} />
                <span>Demote to member</span>
              </button>
            )}
            {isOwner && memberActionUser?.role !== 'owner' && (
              <button className="relay-menu-row" style={rowStyle} onClick={handleTransferOwnership}>
                <Crown size={17} {...iconProps} />
                <span>Make owner</span>
              </button>
            )}
            {canManageGroup && memberActionUser?.role !== 'owner' && (
              <button className="relay-menu-row" style={{ ...rowStyle, color: 'var(--error)', borderBottom: 'none' }} onClick={handleRemoveMember}>
                <UserX size={17} {...iconProps} />
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
