'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, ChevronLeft, Users, Camera, Check, MoreHorizontal, MessageCircle,
  Send, User, Share2, UserX,
} from 'lucide-react'
import BottomSheet from '@/components/shared/BottomSheet'
import ConfirmSheet from '@/components/shared/ConfirmSheet'
import Avatar from '@/components/shared/Avatar'
import { getConversations, getExistingConversation } from '@/actions/messages'
import { createGroup, uploadGroupAvatar } from '@/actions/groups'
import { searchUsers } from '@/actions/users'
import { blockUser, getBlockedUserIds } from '@/actions/blocks'
import { cache } from '@/lib/cache'
import { useProfileSheet } from '@/lib/profile-sheet-context'

const GROUP_NAME_MAX = 50
const GROUP_DESCRIPTION_MAX = 200
const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

// Thin wrapper — BottomSheet already unmounts its children whenever isOpen
// is false, but this component itself never unmounts (the parent keeps it
// mounted at all times, just toggling isOpen), so its own state used to
// persist across opens. Resetting that state in a useEffect on isOpen
// still let one frame of the PREVIOUS session's content (stale search
// text, previously selected members, whatever screen was last open)
// render before the effect fired — visible during BottomSheet's 250ms
// open animation. Keying SheetBody by an incrementing "open generation"
// instead forces React to fully discard the old instance and mount a
// brand new one on every open, fresh state from its very first render,
// no reset effect required.
export default function NewConversationSheet({ isOpen, onClose, initialMode = 'search' }) {
  const [openGen, setOpenGen] = useState(0)

  useEffect(() => {
    if (isOpen) setOpenGen(g => g + 1)
  }, [isOpen])

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="90dvh">
      <SheetBody key={openGen} onClose={onClose} initialMode={initialMode} />
    </BottomSheet>
  )
}

// A single tall sheet with three "screens" that live side by side and
// slide horizontally via CSS transform — nothing ever unmounts between
// them (unlike the chat panel transform-slide that caused real problems
// earlier in this project), since these three panels are fixed, not
// keyed by any changing id. screenIndex: 0 = search/discovery,
// 1 = group step 1 (members), 2 = group step 2 (details).
function SheetBody({ onClose, initialMode }) {
  const router = useRouter()
  const { openProfile } = useProfileSheet()
  const [mode, setMode] = useState(initialMode === 'group' ? 'group' : 'search') // 'search' | 'group'
  const [groupStep, setGroupStep] = useState(1) // 1 | 2
  const [selectedMembers, setSelectedMembers] = useState([])
  const [recentContacts, setRecentContacts] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  // Which row's "open or start a chat" tap is in flight — rather than a
  // blind boolean, this is the specific user id so that row alone can
  // swap to a spinner while every other row visibly disables, instead
  // of leaving the whole screen looking unchanged until it navigates.
  const [openingId, setOpeningId] = useState(null)
  const searchTimeout = useRef(null)
  // Guards a slower response for an earlier query landing after a faster
  // one for a later query — the debounce above only throttles how often a
  // request fires, not the order in which their responses come back.
  const searchSeqRef = useRef(0)

  const [groupName, setGroupName] = useState('')
  const [groupDescription, setGroupDescription] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState(null)

  // Row-level ⋯ menu, Mode 1 (search/discovery) results only — same
  // shape as search/page.js's menu, including the cache-based
  // existing-DM check so the Open-chat/Send-request label never
  // flashes the wrong one before settling.
  const [menuUser, setMenuUser] = useState(null)
  const [menuConvId, setMenuConvId] = useState(null)
  const [checkingConv, setCheckingConv] = useState(false)
  const [blockTarget, setBlockTarget] = useState(null)

  useEffect(() => {
    async function loadRecent() {
      const [result, blockedResult] = await Promise.all([
        getConversations(),
        getBlockedUserIds(),
      ])
      if (result.data) {
        const blockedIds = new Set(blockedResult.data || [])
        const contacts = result.data
          .filter(c => c.type === 'dm')
          .map(c => c.other_participants?.[0])
          .filter(Boolean)
          .map(p => ({
            id: p.user_id || p.id,
            display_name: p.display_name,
            username: p.username,
            avatar_url: p.avatar_url,
          }))
          // The DM itself stays visible in the main chat list (existing
          // conversations aren't hidden from the blocked side), but a
          // blocked contact shouldn't be offered here as someone to
          // start fresh with or add to a new group.
          .filter(c => !blockedIds.has(c.id))
        setRecentContacts(contacts)
      }
    }
    loadRecent()
  }, [])

  // searchUsers() itself still requires 3+ characters server-side (kept
  // as-is, per instructions not to change existing server actions) — but
  // the UI reacts to the very first keystroke instead of gatekeeping the
  // whole search screen behind a client-side 3-char minimum like the old
  // search page did. 1-2 characters just show a "keep typing" hint
  // rather than a premature "no results".
  const handleSearch = (value) => {
    setSearchQuery(value)
    const seq = ++searchSeqRef.current
    if (searchTimeout.current) clearTimeout(searchTimeout.current)

    const trimmed = value.trim()
    if (trimmed.length < 3) {
      setSearchResults([])
      setSearching(false)
      return
    }

    setSearching(true)
    searchTimeout.current = setTimeout(async () => {
      const result = await searchUsers(trimmed)
      if (seq !== searchSeqRef.current) return
      setSearchResults(result.data || [])
      setSearching(false)
    }, 300)
  }

  const toggleMember = (user) => {
    setSelectedMembers(prev => {
      const exists = prev.find(m => m.id === user.id)
      if (exists) return prev.filter(m => m.id !== user.id)
      return [...prev, user]
    })
  }

  const isSelected = (userId) => selectedMembers.some(m => m.id === userId)

  const checkExistingDM = async (userId) => {
    const cacheKey = `existing-dm:${userId}`
    const cached = cache.get(cacheKey)
    if (cached !== null) return cached || null
    const result = await getExistingConversation(userId)
    cache.set(cacheKey, result.conversationId || false, 30000)
    return result.conversationId || null
  }

  // Mode 1 row tap (recent contact or search result): opens the existing
  // DM if there is one. Otherwise this app always requires an opening
  // message before a conversation exists (sendMessageRequest has no
  // message-less path) — so rather than invent a way around that, this
  // goes to their profile, where the existing MessageButton already
  // handles composing that first message.
  const handleRowTap = async (user) => {
    setOpeningId(user.id)
    const conversationId = await checkExistingDM(user.id)
    onClose?.()
    if (conversationId) {
      router.push(`/chat/${conversationId}`)
    } else {
      openProfile(user.username)
    }
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const goToGroupCreation = () => {
    setMode('group')
    setGroupStep(1)
  }

  const backToSearch = () => {
    setMode('search')
    setSelectedMembers([])
    setSearchQuery('')
    setSearchResults([])
  }

  const backToMembers = () => {
    setGroupStep(1)
  }

  const handleCreateGroup = async () => {
    if (!groupName.trim()) { setError('Group name is required'); return }
    setIsCreating(true)
    setError(null)

    const formData = new FormData()
    formData.append('name', groupName.trim().slice(0, GROUP_NAME_MAX))
    formData.append('description', groupDescription.trim().slice(0, GROUP_DESCRIPTION_MAX))
    selectedMembers.forEach(m => formData.append('memberIds', m.id))

    const result = await createGroup(formData)
    if (result.error) {
      setError(result.error)
      setIsCreating(false)
      return
    }

    if (avatarFile) {
      const avatarFormData = new FormData()
      avatarFormData.append('avatar', avatarFile)
      await uploadGroupAvatar(result.conversationId, avatarFormData)
    }

    try { window.navigator.vibrate?.(10) } catch {}

    onClose?.()
    router.push(`/chat/${result.conversationId}`)
  }

  // --- Mode 1 row menu (search results only) ---

  const openRowMenu = async (user) => {
    setMenuUser(user)
    const cacheKey = `existing-dm:${user.id}`
    const cached = cache.get(cacheKey)
    if (cached !== null) {
      setMenuConvId(cached || null)
      setCheckingConv(false)
      return
    }
    setMenuConvId(null)
    setCheckingConv(true)
    const conversationId = await checkExistingDM(user.id)
    setMenuConvId(conversationId)
    setCheckingConv(false)
  }

  const closeRowMenu = () => {
    setMenuUser(null)
    setMenuConvId(null)
    setCheckingConv(false)
  }

  const handleMenuOpenOrRequest = () => {
    if (!menuUser) return
    const username = menuUser.username
    const convId = menuConvId
    closeRowMenu()
    onClose?.()
    if (convId) {
      router.push(`/chat/${convId}`)
    } else {
      openProfile(username)
    }
  }

  const handleMenuViewProfile = () => {
    if (!menuUser) return
    const username = menuUser.username
    closeRowMenu()
    onClose?.()
    openProfile(username)
  }

  const handleMenuShareProfile = async () => {
    if (!menuUser) return
    const url = `${window.location.origin}/u/${menuUser.username}`
    try { await navigator.clipboard.writeText(url) } catch {}
    closeRowMenu()
  }

  const handleMenuBlockClick = () => {
    setBlockTarget(menuUser)
    closeRowMenu()
  }

  const confirmBlock = async () => {
    if (!blockTarget) return
    const result = await blockUser(blockTarget.id)
    if (result?.error) return result
    setSearchResults(prev => prev.filter(u => u.id !== blockTarget.id))
    setBlockTarget(null)
    return result
  }

  const isTyping = searchQuery.trim().length > 0
  const screenIndex = mode === 'search' ? 0 : groupStep === 1 ? 1 : 2
  const canCreateGroup = groupName.trim().length > 0

  const chipsRow = (
    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '12px 20px 0', WebkitOverflowScrolling: 'touch' }}>
      {selectedMembers.map(m => <MemberChip key={m.id} user={m} onRemove={() => toggleMember(m)} />)}
    </div>
  )

  return (
    <>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', -apple-system, sans-serif" }}>
        {/* Header — chrome, swaps instantly; only the body below animates */}
        {mode === 'search' ? (
          <div style={headerStyle}>
            <h2 style={headerTitleStyle}>New conversation</h2>
            <button onClick={onClose} className="relay-plain-icon-btn" aria-label="Close">
              <X size={20} {...iconProps} />
            </button>
          </div>
        ) : (
          <div style={headerStyle}>
            <button
              onClick={groupStep === 1 ? backToSearch : backToMembers}
              className="relay-plain-icon-btn"
              aria-label="Back"
            >
              <ChevronLeft size={22} {...iconProps} />
            </button>
            <h2 style={{ ...headerTitleStyle, flex: 1 }}>New Group</h2>
            <button onClick={onClose} className="relay-plain-icon-btn" aria-label="Close">
              <X size={20} {...iconProps} />
            </button>
          </div>
        )}

        {/* Sliding body */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <div style={{
            display: 'flex',
            width: '300%',
            height: '100%',
            transform: `translateX(-${screenIndex * (100 / 3)}%)`,
            transition: 'transform 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}>
            {/* Screen 0: Search / discovery */}
            <div style={{ width: `${100 / 3}%`, height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ padding: '12px 20px 0' }}>
                <input
                  type="text"
                  value={mode === 'search' ? searchQuery : ''}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="Search by username..."
                  className="relay-input"
                  style={searchInputStyle}
                />
              </div>

              {!isTyping ? (
                <>
                  <button
                    onClick={goToGroupCreation}
                    className="relay-menu-row"
                    style={{ padding: '14px 20px', borderRadius: 0, borderBottom: '1px solid var(--border-light)', marginTop: '8px' }}
                  >
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--surface)', border: '2px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--text)' }}>
                      <Users size={18} {...iconProps} />
                    </div>
                    <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>New Group</p>
                  </button>

                  {recentContacts.length > 0 && (
                    <p style={sectionHeaderStyle}>Recent</p>
                  )}
                  {recentContacts.map(u => (
                    <SearchResultRow key={u.id} user={u} opening={openingId === u.id} disabled={!!openingId} onTap={() => handleRowTap(u)} onMenu={() => openRowMenu(u)} />
                  ))}
                </>
              ) : (
                <div style={{ paddingTop: '8px' }}>
                  {searchQuery.trim().length < 3 ? (
                    <p style={hintTextStyle}>Keep typing to search...</p>
                  ) : searching ? (
                    <p style={hintTextStyle}>Searching...</p>
                  ) : searchResults.length === 0 ? (
                    <p style={hintTextStyle}>No users found</p>
                  ) : (
                    searchResults.map(u => (
                      <SearchResultRow key={u.id} user={u} opening={openingId === u.id} disabled={!!openingId} onTap={() => handleRowTap(u)} onMenu={() => openRowMenu(u)} />
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Screen 1: Group step 1 — add members */}
            <div style={{ width: `${100 / 3}%`, height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ padding: '12px 20px 0' }}>
                <input
                  type="text"
                  value={mode === 'group' && groupStep === 1 ? searchQuery : ''}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="Search by username..."
                  className="relay-input"
                  style={searchInputStyle}
                />
              </div>

              {selectedMembers.length > 0 && (
                <>
                  {chipsRow}
                  <p style={{ padding: '8px 20px 0', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                    {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected
                  </p>
                </>
              )}

              {!isTyping ? (
                <>
                  {recentContacts.length > 0 && (
                    <p style={sectionHeaderStyle}>Recent</p>
                  )}
                  {recentContacts.map(u => (
                    <MemberSelectRow key={u.id} user={u} selected={isSelected(u.id)} onTap={() => toggleMember(u)} />
                  ))}
                </>
              ) : (
                <div style={{ paddingTop: '8px' }}>
                  {searchQuery.trim().length < 3 ? (
                    <p style={hintTextStyle}>Keep typing to search...</p>
                  ) : searching ? (
                    <p style={hintTextStyle}>Searching...</p>
                  ) : searchResults.length === 0 ? (
                    <p style={hintTextStyle}>No users found</p>
                  ) : (
                    searchResults.map(u => (
                      <MemberSelectRow key={u.id} user={u} selected={isSelected(u.id)} onTap={() => toggleMember(u)} />
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Screen 2: Group step 2 — details */}
            <div style={{ width: `${100 / 3}%`, height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ padding: '16px 20px 0' }}>
                {chipsRow}
                <p style={{ padding: '8px 0 0', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''}
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
                  <label style={{ cursor: 'pointer', position: 'relative' }}>
                    <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Group avatar" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-strong)', display: 'block' }} />
                    ) : (
                      <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--surface)', border: '2px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                        <Camera size={26} {...iconProps} />
                      </div>
                    )}
                    <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', marginTop: '8px' }}>Add photo</p>
                  </label>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={fieldLabelStyle}>Group name *</label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={e => setGroupName(e.target.value.slice(0, GROUP_NAME_MAX))}
                    placeholder="e.g. Study Group, Family, Work Team"
                    maxLength={GROUP_NAME_MAX}
                    className="relay-input"
                    style={fieldInputStyle}
                  />
                  {groupName.length >= GROUP_NAME_MAX - 10 && (
                    <p style={charCountStyle}>{groupName.length}/{GROUP_NAME_MAX}</p>
                  )}
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <label style={fieldLabelStyle}>Description</label>
                  <input
                    type="text"
                    value={groupDescription}
                    onChange={e => setGroupDescription(e.target.value.slice(0, GROUP_DESCRIPTION_MAX))}
                    placeholder="What's this group about?"
                    maxLength={GROUP_DESCRIPTION_MAX}
                    className="relay-input"
                    style={fieldInputStyle}
                  />
                  {groupDescription.length >= GROUP_DESCRIPTION_MAX - 20 && (
                    <p style={charCountStyle}>{groupDescription.length}/{GROUP_DESCRIPTION_MAX}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer — persistent action bar per step, outside the sliding
            area so it never has to fight the same layout math that broke
            the bulk-select action bar earlier (plain flex, no
            sticky/fixed positioning needed). */}
        {mode === 'group' && groupStep === 1 && (
          <div style={{ flexShrink: 0, padding: '12px 20px', borderTop: '2px solid var(--border-strong)', background: 'var(--surface)' }}>
            <button
              onClick={() => setGroupStep(2)}
              disabled={selectedMembers.length === 0}
              className="relay-btn relay-btn--filled"
              style={{ width: '100%', padding: '12px', fontSize: '14px', boxShadow: 'var(--shadow-hard-accent)' }}
            >
              Next
            </button>
          </div>
        )}

        {mode === 'group' && groupStep === 2 && (
          <div style={{ flexShrink: 0, padding: '12px 20px', borderTop: '2px solid var(--border-strong)', background: 'var(--surface)' }}>
            {error && (
              <div style={{ background: 'var(--error-light)', border: '1.5px solid var(--error)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: '10px', fontSize: '13px', color: 'var(--error)' }}>
                {error}
              </div>
            )}
            <button
              onClick={handleCreateGroup}
              disabled={!canCreateGroup || isCreating}
              className="relay-btn relay-btn--filled"
              style={{ width: '100%', padding: '12px', fontSize: '14px', gap: '8px', boxShadow: 'var(--shadow-hard-accent)' }}
            >
              {isCreating && <Spinner variant="onDark" />}
              {isCreating ? 'Creating...' : 'Create group'}
            </button>
          </div>
        )}
      </div>

      <BottomSheet isOpen={!!menuUser} onClose={closeRowMenu}>
        <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px 16px', borderBottom: '1px solid var(--border-light)' }}>
            <Avatar src={menuUser?.avatar_url} name={menuUser?.display_name} size={40} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>{menuUser?.display_name}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>@{menuUser?.username}</p>
            </div>
          </div>
          <div style={{ padding: '8px 0' }}>
            <button
              className="relay-menu-row"
              style={{ ...menuRowStyle }}
              onClick={handleMenuOpenOrRequest}
              disabled={checkingConv}
            >
              {checkingConv ? <Spinner /> : menuConvId ? <MessageCircle size={17} {...iconProps} /> : <Send size={17} {...iconProps} />}
              {checkingConv ? 'Checking...' : menuConvId ? 'Open chat' : 'Send message request'}
            </button>
            <button className="relay-menu-row" style={menuRowStyle} onClick={handleMenuViewProfile}>
              <User size={17} {...iconProps} /> View profile
            </button>
            <button className="relay-menu-row" style={menuRowStyle} onClick={handleMenuShareProfile}>
              <Share2 size={17} {...iconProps} /> Share profile
            </button>
            <button className="relay-menu-row" style={{ ...menuRowStyle, color: 'var(--error)' }} onClick={handleMenuBlockClick}>
              <UserX size={17} {...iconProps} /> Block
            </button>
          </div>
        </div>
      </BottomSheet>

      <ConfirmSheet
        isOpen={!!blockTarget}
        onClose={() => setBlockTarget(null)}
        title="Block this user?"
        message={`${blockTarget?.display_name || 'This user'} won't be able to message you or see your profile.`}
        confirmLabel="Block"
        confirmStyle="danger"
        onConfirm={confirmBlock}
      />
    </>
  )
}

function MemberChip({ user, onRemove }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px 4px 6px',
      background: 'var(--surface)',
      border: '2px solid var(--border-strong)',
      borderRadius: 'var(--radius-pill)',
      fontSize: '13px',
      fontWeight: '600',
      color: 'var(--text)',
      flexShrink: 0,
      whiteSpace: 'nowrap',
    }}>
      <Avatar src={user.avatar_url} name={user.display_name} size={20} />
      {user.display_name}
      <button
        onClick={onRemove}
        aria-label={`Remove ${user.display_name}`}
        style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-secondary)', marginLeft: '2px' }}
      >
        <X size={13} {...iconProps} />
      </button>
    </div>
  )
}

// Mode 1 (search/discovery): tapping the row navigates; a separate ⋯
// button opens the menu. Not nested inside a Link (unlike ChatLink
// elsewhere), so no navigation-suppression tricks are needed here.
// `opening`/`disabled` give the tapped row its own spinner while every
// row in the list disables — a tap into a profile or existing DM can
// take a beat (existing-DM lookup), and this app never leaves that gap
// silent.
function SearchResultRow({ user, onTap, onMenu, opening, disabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderBottom: '1px solid var(--border-light)', opacity: disabled && !opening ? 0.5 : 1 }}>
      <button
        onClick={onTap}
        disabled={disabled}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: disabled ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
      >
        <Avatar src={user.avatar_url} name={user.display_name} size={40} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.display_name}</p>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{opening ? 'Opening...' : `@${user.username}`}</p>
        </div>
        {opening && <Spinner />}
      </button>
      <button
        onClick={onMenu}
        disabled={disabled}
        aria-label="More options"
        className="relay-plain-icon-btn"
        style={{ width: '32px', height: '32px', flexShrink: 0 }}
      >
        <MoreHorizontal size={18} {...iconProps} />
      </button>
    </div>
  )
}

// Mode 2 (group creation): tapping anywhere on the row toggles selection.
function MemberSelectRow({ user, selected, onTap }) {
  return (
    <button
      onClick={onTap}
      className="relay-menu-row"
      style={{ padding: '10px 20px', borderRadius: 0, borderBottom: '1px solid var(--border-light)' }}
    >
      <Avatar src={user.avatar_url} name={user.display_name} size={40} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.display_name}</p>
        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>@{user.username}</p>
      </div>
      <div style={{
        width: '24px',
        height: '24px',
        borderRadius: 'var(--radius-pill)',
        border: `2px solid ${selected ? 'var(--border-strong)' : 'var(--border)'}`,
        background: selected ? 'var(--text)' : 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {selected && <Check size={13} strokeWidth={3} color="var(--background)" />}
      </div>
    </button>
  )
}

// variant 'onDark' is for a spinner sitting on the filled CTA button
// (background var(--text)) — needs light strokes to read against it,
// the inverse of the default neutral-row spinner.
function Spinner({ size = 14, variant = 'default' }) {
  const trackColor = variant === 'onDark' ? 'rgba(255,255,255,0.3)' : 'var(--border)'
  const headColor = variant === 'onDark' ? 'var(--background)' : 'var(--text-secondary)'
  return (
    <div style={{
      width: size,
      height: size,
      border: `2px solid ${trackColor}`,
      borderTopColor: headColor,
      borderRadius: '50%',
      animation: 'relay-ncs-spin 0.7s linear infinite',
      flexShrink: 0,
    }}>
      <style>{`
        @keyframes relay-ncs-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

const headerStyle = {
  padding: '4px 16px 12px 20px',
  borderBottom: '1px solid var(--border-light)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexShrink: 0,
  gap: '8px',
}

const headerTitleStyle = {
  fontSize: '16px',
  fontWeight: '700',
  color: 'var(--text)',
}

const searchInputStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 'var(--radius-pill)',
  fontSize: '16px',
  boxSizing: 'border-box',
}

const sectionHeaderStyle = {
  fontSize: '11px',
  fontWeight: '700',
  color: 'var(--text-tertiary)',
  letterSpacing: '1px',
  textTransform: 'uppercase',
  padding: '16px 20px 4px',
}

const hintTextStyle = {
  fontSize: '13px',
  color: 'var(--text-tertiary)',
  padding: '16px 20px',
}

const fieldLabelStyle = {
  fontSize: '13px',
  fontWeight: '700',
  color: 'var(--text)',
  display: 'block',
  marginBottom: '8px',
}

const fieldInputStyle = {
  width: '100%',
  padding: '12px 14px',
  fontSize: '16px',
  boxSizing: 'border-box',
}

const charCountStyle = {
  fontSize: '11px',
  color: 'var(--text-tertiary)',
  marginTop: '4px',
  textAlign: 'right',
}

const menuRowStyle = {
  padding: '14px 20px',
  fontSize: '15px',
  fontWeight: '600',
  color: 'var(--text)',
  borderRadius: 0,
}
