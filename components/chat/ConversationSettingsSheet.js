'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell, BellOff, Pin, Star, Search, CheckSquare, ChevronRight, Pencil,
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
  onOpenStarred,
  onGroupChanged,
  onSelectMessages,
}) {
  const router = useRouter()
  const { openProfile } = useProfileSheet()
  const [muteStatus, setMuteStatus] = useState({ muted: false, mutedUntil: null })
  const [showMutePicker, setShowMutePicker] = useState(false)
  const [muting, setMuting] = useState(false)
  const [mutingLabel, setMutingLabel] = useState(null)
  const [hiding, setHiding] = useState(false)
  const [menuError, setMenuError] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
  const [memberActionUser, setMemberActionUser] = useState(null)
  const [showAddMember, setShowAddMember] = useState(false)
  const [memberQuery, setMemberQuery] = useState('')
  const [memberResults, setMemberResults] = useState([])
  const [searching, setSearching] = useState(false)
  const memberSearchTimeout = useRef(null)
  const memberSearchSeqRef = useRef(0)
  const [addMemberFeedback, setAddMemberFeedback] = useState(null)
  const [acting, setActing] = useState(null)
  // Locally reflects role changes the instant an action succeeds, ahead
  // of onGroupChanged's server refetch — keyed by user_id, only ever
  // holds entries this sheet itself just changed.
  const [roleOverrides, setRoleOverrides] = useState({})
  // Same idea as roleOverrides but for membership itself — removeMember
  // succeeding used to just close the per-member sheet and wait on
  // onGroupChanged's async refetch, so the removed member's row stayed
  // visible in this same list for however long that took.
  const [removedMemberIds, setRemovedMemberIds] = useState(new Set())
  // Same idea again but for a member just added — addMember's search
  // result already carries the full profile (avatar/name/username), so
  // there's enough to render a real row immediately instead of waiting
  // on the refetch. Cleared once that refetch's groupInfo.members
  // actually contains this user_id, so it doesn't end up duplicated.
  const [addedMembers, setAddedMembers] = useState([])
  useEffect(() => {
    if (addedMembers.length === 0) return
    const realIds = new Set(groupInfo?.members?.map(m => m.user_id) || [])
    setAddedMembers(prev => prev.filter(m => !realIds.has(m.user_id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupInfo?.members])
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
  // Was a regression to the exact "no crop, no feedback" pattern already
  // fixed for the personal profile photo and NewConversationSheet's own
  // group-creation avatar — this sub-sheet's Avatar kept rendering the
  // OLD photo for the entire upload (avatarUploading only disabled the
  // camera button), and a bad file round-tripped to the server before
  // the user learned anything.
  const [avatarPreview, setAvatarPreview] = useState(null)
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
  // Single source of truth for what the member list (and its header
  // counts) actually shows — folds in both optimistic mechanisms above
  // so a remove/add is reflected immediately instead of waiting on
  // onGroupChanged's refetch. addedMembers is already known not to
  // overlap groupInfo.members (the clearing effect above removes an
  // entry the moment it does), so no dedupe needed here.
  const visibleMembers = [
    ...(groupInfo?.members?.filter(m => !removedMemberIds.has(m.user_id)) || []),
    // Also filtered by removedMemberIds — handles the narrow case of
    // adding someone then removing them again before onGroupChanged's
    // refetch had a chance to land, where they'd otherwise still only
    // exist in this array (not yet in groupInfo.members) and show up
    // despite having just been removed.
    ...addedMembers.filter(m => !removedMemberIds.has(m.user_id)),
  ]
  const visibleMemberCount = visibleMembers.length

  const handleMute = async (hours, label) => {
    setMuting(true)
    setMutingLabel(label)
    const mutedUntil = hours ? Date.now() + hours * 3600000 : null
    const result = await muteConversation(conversationId, mutedUntil)
    if (!result.error) {
      const next = { muted: true, mutedUntil: mutedUntil ? new Date(mutedUntil).toISOString() : null }
      setMuteStatus(next)
      cache.set(`mute:${conversationId}`, next, 30000)
      // ChatList primes its whole-list mute icons from this key (see
      // ChatList.js:86/132) and only invalidates it after a *bulk* mute —
      // a single-conversation mute/unmute here left it stale for up to
      // 30s, so the list kept showing the old bell/no-bell state.
      cache.invalidate('muted-ids')
      setShowMutePicker(false)
    }
    setMuting(false)
    setMutingLabel(null)
  }

  const handleUnmute = async () => {
    setMuting(true)
    const result = await unmuteConversation(conversationId)
    if (!result.error) {
      setMuteStatus({ muted: false, mutedUntil: null })
      cache.invalidate(`mute:${conversationId}`)
      cache.invalidate('muted-ids')
    }
    setMuting(false)
  }

  const handleHide = async () => {
    vibrate()
    setHiding(true)
    const result = await hideConversation(conversationId)
    if (result?.error) {
      setHiding(false)
      showMenuError(result.error)
      return
    }
    onClose?.()
    // replace, not push — a hidden/deleted/left conversation's URL
    // shouldn't remain a valid back-navigation target in history.
    router.replace('/chat')
  }

  const handleBlock = async () => {
    if (!otherParticipant) return
    const result = await blockUser(otherParticipant.id)
    if (result?.error) return result
    // Same signal ConversationActionSheet/ConversationContextMenu's own
    // block handlers already fire — without it, ChatList (which stays
    // mounted across this navigation) wouldn't know to drop the now-
    // hidden conversation from its list until some later, unrelated
    // trigger refreshed it.
    window.dispatchEvent(new Event('relay:conversations-changed'))
    onClose?.()
    router.replace('/chat')
    return result
  }

  const handleShareProfile = async () => {
    if (!otherParticipant) return
    const url = `${window.location.origin}/u/${otherParticipant.username}`
    if (navigator.share) {
      try { await navigator.share({ url }); return } catch { /* fall through to copy */ }
    }
    try { await navigator.clipboard.writeText(url) } catch {}
  }

  const handleLeaveGroup = async () => {
    const result = await leaveGroup(conversationId)
    if (result?.error) return result
    window.dispatchEvent(new Event('relay:conversations-changed'))
    onClose?.()
    router.replace('/chat')
    return result
  }

  const handleDeleteGroup = async () => {
    const result = await deleteGroup(conversationId)
    if (result?.error) return result
    window.dispatchEvent(new Event('relay:conversations-changed'))
    onClose?.()
    router.replace('/chat')
    return result
  }

  const handleMemberSearch = (q) => {
    setMemberQuery(q)
    const seq = ++memberSearchSeqRef.current
    if (memberSearchTimeout.current) clearTimeout(memberSearchTimeout.current)

    if (q.trim().length < 3) {
      setMemberResults([])
      setSearching(false)
      return
    }

    setSearching(true)
    memberSearchTimeout.current = setTimeout(async () => {
      const result = await searchUsers(q)
      if (seq !== memberSearchSeqRef.current) return
      if (result.data) {
        const memberIds = groupInfo?.members?.map(m => m.user_id) || []
        setMemberResults(result.data.filter(u => !memberIds.includes(u.id)))
      }
      setSearching(false)
    }, 300)
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
    // Matches uploadGroupAvatar's own server-side validation exactly —
    // catching this here means a bad file gets an immediate inline
    // error instead of a wasted round trip.
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      setEditError('Only images are allowed (JPEG, PNG, WebP, GIF)')
      e.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setEditError('Image must be under 5MB')
      e.target.value = ''
      return
    }
    setEditError(null)
    const previewUrl = URL.createObjectURL(file)
    setAvatarPreview(previewUrl)
    setAvatarUploading(true)
    const data = new FormData()
    data.append('avatar', file)
    const result = await uploadGroupAvatar(conversationId, data)
    if (result.error) {
      setEditError(result.error)
      URL.revokeObjectURL(previewUrl)
      setAvatarPreview(null)
    } else {
      // Left showing (not revoked here) until the effect below sees
      // groupInfo.avatar_url actually change to the real uploaded URL —
      // revoking immediately would leave a gap back to the old photo for
      // however long onGroupChanged's refetch takes to land.
      onGroupChanged?.()
    }
    setAvatarUploading(false)
  }

  // Bridges that gap: once the parent's refetch lands a new avatar_url,
  // the preview has done its job and can be swapped out for the real one.
  useEffect(() => {
    if (!avatarPreview) return
    setAvatarPreview(null)
    URL.revokeObjectURL(avatarPreview)
    // Only ever meant to fire once groupInfo?.avatar_url itself changes —
    // re-running on every avatarPreview change would revoke it the
    // instant it's set, which is exactly what this exists to avoid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupInfo?.avatar_url])

  // Takes the full search-result user object (not just the id) — it
  // already carries avatar_url/display_name/username, enough to render
  // a real member row immediately via addedMembers rather than the
  // member list staying one short until onGroupChanged's refetch lands.
  const handleAddMember = async (user) => {
    setActing(user.id)
    setAddMemberFeedback(null)
    const result = await addMember(conversationId, user.id)
    setActing(null)

    if (result.error) {
      setAddMemberFeedback({ type: 'error', text: result.error })
      return
    }

    setMemberQuery('')
    setMemberResults([])
    if (result.invited) {
      setAddMemberFeedback({ type: 'invited', text: 'Invite sent — they\'ll join once they accept it.' })
    } else {
      setAddedMembers(prev => [...prev, {
        user_id: user.id,
        avatar_url: user.avatar_url,
        display_name: user.display_name,
        username: user.username,
        role: 'member',
      }])
      setShowAddMember(false)
      onGroupChanged?.()
    }
  }

  const handleRemoveMember = async () => {
    if (!memberActionUser) return
    const targetId = memberActionUser.user_id
    setActing(targetId)
    const result = await removeMember(conversationId, targetId)
    setActing(null)
    if (result?.error) return result
    setMemberActionUser(null)
    setRemovedMemberIds(prev => new Set(prev).add(targetId))
    onGroupChanged?.()
    return result
  }

  const showMenuError = (msg) => {
    setMenuError(msg)
    setTimeout(() => setMenuError(null), 3000)
  }

  const handlePromote = async (userId) => {
    setActing(userId)
    const result = await promoteToAdmin(conversationId, userId)
    setActing(null)
    if (result?.error) { showMenuError(result.error); return }
    setMemberActionUser(null)
    // Same roleOverrides mechanism handleTransferOwnership already uses
    // below — without it, the member list's role badge stayed stale
    // ("Member") until onGroupChanged's async refetch caught up, even
    // though this action sheet had already closed as if it were done.
    setRoleOverrides(prev => ({ ...prev, [userId]: 'admin' }))
    onGroupChanged?.()
  }

  const handleDemote = async (userId) => {
    setActing(userId)
    const result = await demoteAdmin(conversationId, userId)
    setActing(null)
    if (result?.error) { showMenuError(result.error); return }
    setMemberActionUser(null)
    setRoleOverrides(prev => ({ ...prev, [userId]: 'member' }))
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

    if (result.error) {
      showMenuError(result.error)
      return
    }

    setMemberActionUser(null)
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
    if (role === 'owner') return <span style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 8px', background: 'var(--accent)', border: '1.5px solid var(--border-strong)', borderRadius: 'var(--radius-pill)', fontSize: '10px', fontWeight: '700', color: 'var(--on-accent)' }}><Crown size={10} {...iconProps} /> Owner</span>
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
          {menuError && (
            <div style={{ padding: '10px 20px', background: 'var(--error-light)', borderBottom: '1px solid var(--border-light)', fontSize: '13px', color: 'var(--error)', fontWeight: '600', textAlign: 'center' }}>
              {menuError}
            </div>
          )}
          {/* Identity card */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px', borderBottom: '2px solid var(--border-strong)' }}>
            <Avatar src={isGroup ? groupInfo?.avatar_url : otherParticipant?.avatar_url} name={name} size={72} />
            <p style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', marginTop: '12px' }}>{name}</p>
            {isGroup ? (
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{visibleMemberCount} members</p>
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
                  {muting ? 'Unmuting...' : 'Unmute'}
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
                    onClick={() => handleMute(opt.hours, opt.label)}
                    className="relay-menu-row"
                    style={{ borderRadius: 0, borderBottom: '1px solid var(--border-light)', fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}
                  >
                    {mutingLabel === opt.label ? 'Muting...' : opt.label}
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
          {/* Sits directly under Pinned since they're the two "saved
              messages" views — pinned is shared with the conversation,
              starred is private to this user. */}
          <button className="relay-menu-row" style={rowStyle} onClick={() => { onClose?.(); onOpenStarred?.() }}>
            <Star size={17} {...iconProps} />
            <span style={{ flex: 1 }}>Starred messages</span>
            <ChevronRight size={15} {...iconProps} color="var(--text-tertiary)" />
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
                    Members ({visibleMemberCount})
                  </p>
                  {canManageGroup && (
                    <button onClick={() => setShowAddMember(true)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: 'var(--text)', fontFamily: 'inherit' }}>
                      <UserPlus size={15} {...iconProps} /> Add
                    </button>
                  )}
                </div>
              </div>
              <div style={{ maxHeight: '240px', overflowY: 'auto', borderBottom: '1px solid var(--border-light)' }}>
                {visibleMembers.map(member => {
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
                          {/* flex+minWidth:0 (missing before) is required
                              for the ellipsis to actually engage — a flex
                              child otherwise refuses to shrink below its
                              own text's natural width, so a long name next
                              to a role badge could overflow/crowd it
                              instead of truncating. */}
                          <p style={{ flex: 1, minWidth: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.display_name}</p>
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
              <button className="relay-menu-row" style={{ ...rowStyle, color: 'var(--error)', borderBottom: 'none' }} onClick={handleHide} disabled={hiding}>
                <EyeOff size={17} {...iconProps} />
                <span>{hiding ? 'Hiding...' : 'Hide conversation'}</span>
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
              <Avatar src={avatarPreview || groupInfo?.avatar_url} name={groupInfo?.name} size={64} />
              {avatarUploading && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.5)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  color: '#fff',
                  fontWeight: '700',
                }}>
                  ...
                </div>
              )}
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
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{visibleMemberCount} members</p>
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
              {/* Same "only once within 20% of the cap" threshold
                  NewConversationSheet's own group-creation step and
                  EditProfileForm already use — this sibling edit flow
                  silently truncated with no warning before it. */}
              {editFormData.name.length >= GROUP_NAME_MAX * 0.8 && (
                <p style={{ fontSize: '11px', color: editFormData.name.length >= GROUP_NAME_MAX ? 'var(--error)' : 'var(--text-tertiary)', textAlign: 'right', marginTop: '4px' }}>
                  {editFormData.name.length}/{GROUP_NAME_MAX}
                </p>
              )}
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
              {editFormData.description.length >= GROUP_DESCRIPTION_MAX * 0.8 && (
                <p style={{ fontSize: '11px', color: editFormData.description.length >= GROUP_DESCRIPTION_MAX ? 'var(--error)' : 'var(--text-tertiary)', textAlign: 'right', marginTop: '4px' }}>
                  {editFormData.description.length}/{GROUP_DESCRIPTION_MAX}
                </p>
              )}
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
                  onClick={() => handleAddMember(u)}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px 16px', borderBottom: '1px solid var(--border-light)' }}>
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
              <button className="relay-menu-row" style={rowStyle} onClick={() => handlePromote(memberActionUser.user_id)} disabled={acting === memberActionUser.user_id}>
                <ShieldCheck size={17} {...iconProps} />
                <span>{acting === memberActionUser.user_id ? 'Promoting...' : 'Promote to admin'}</span>
              </button>
            )}
            {isOwner && memberActionUser?.role === 'admin' && (
              <button className="relay-menu-row" style={rowStyle} onClick={() => handleDemote(memberActionUser.user_id)} disabled={acting === memberActionUser.user_id}>
                <ShieldOff size={17} {...iconProps} />
                <span>{acting === memberActionUser.user_id ? 'Demoting...' : 'Demote to member'}</span>
              </button>
            )}
            {isOwner && memberActionUser?.role !== 'owner' && (
              <button className="relay-menu-row" style={rowStyle} onClick={handleTransferOwnership} disabled={acting === memberActionUser?.user_id}>
                <Crown size={17} {...iconProps} />
                <span>{acting === memberActionUser?.user_id ? 'Transferring...' : 'Make owner'}</span>
              </button>
            )}
            {/* Matches actions/groups.js's removeMember check exactly — an
                admin (not owner) removing a fellow admin always gets
                rejected server-side ("Only the owner can remove admins"),
                so the control shouldn't be offered only to bounce back
                with an error after a round trip. */}
            {canManageGroup && memberActionUser?.role !== 'owner' && (isOwner || memberActionUser?.role !== 'admin') && (
              <button className="relay-menu-row" style={{ ...rowStyle, color: 'var(--error)', borderBottom: 'none' }} onClick={() => setConfirmAction('remove')}>
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
        isOpen={confirmAction === 'remove'}
        onClose={() => setConfirmAction(null)}
        title="Remove from group?"
        message={`${memberActionUser?.display_name} will need to be re-invited to rejoin.`}
        confirmLabel="Remove"
        confirmStyle="danger"
        onConfirm={handleRemoveMember}
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
