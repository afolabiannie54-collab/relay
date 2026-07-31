'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import BottomSheet from '@/components/shared/BottomSheet'
import ConfirmSheet from '@/components/shared/ConfirmSheet'
import Avatar from '@/components/shared/Avatar'
import { getConversations, getExistingConversation } from '@/actions/messages'
import { createGroup, uploadGroupAvatar } from '@/actions/groups'
import { searchUsers } from '@/actions/users'
import { blockUser } from '@/actions/blocks'
import { cache } from '@/lib/cache'

const GROUP_NAME_MAX = 50
const GROUP_DESCRIPTION_MAX = 200

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
  const [mode, setMode] = useState(initialMode === 'group' ? 'group' : 'search') // 'search' | 'group'
  const [groupStep, setGroupStep] = useState(1) // 1 | 2
  const [selectedMembers, setSelectedMembers] = useState([])
  const [recentContacts, setRecentContacts] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [opening, setOpening] = useState(false)
  const searchTimeout = useRef(null)

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
      const result = await getConversations()
      if (result.data) {
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
    if (searchTimeout.current) clearTimeout(searchTimeout.current)

    const trimmed = value.trim()
    if (trimmed.length < 3) {
      setSearchResults([])
      return
    }

    setSearching(true)
    searchTimeout.current = setTimeout(async () => {
      const result = await searchUsers(trimmed)
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
    setOpening(true)
    const conversationId = await checkExistingDM(user.id)
    setOpening(false)
    if (conversationId) {
      router.push(`/chat/${conversationId}`)
    } else {
      router.push(`/u/${user.username}?from=search`)
    }
    onClose?.()
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
    if (menuConvId) {
      router.push(`/chat/${menuConvId}`)
    } else {
      router.push(`/u/${menuUser.username}?from=search`)
    }
    closeRowMenu()
    onClose?.()
  }

  const handleMenuViewProfile = () => {
    if (!menuUser) return
    router.push(`/u/${menuUser.username}?from=search`)
    closeRowMenu()
    onClose?.()
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
    await blockUser(blockTarget.id)
    setSearchResults(prev => prev.filter(u => u.id !== blockTarget.id))
    setBlockTarget(null)
  }

  const isTyping = searchQuery.trim().length > 0
  const screenIndex = mode === 'search' ? 0 : groupStep === 1 ? 1 : 2

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
            <button onClick={onClose} style={closeBtnStyle} aria-label="Close">✕</button>
          </div>
        ) : (
          <div style={headerStyle}>
            <button
              onClick={groupStep === 1 ? backToSearch : backToMembers}
              style={backBtnStyle}
              aria-label="Back"
            >
              ←
            </button>
            <h2 style={{ ...headerTitleStyle, flex: 1 }}>New Group</h2>
            <button onClick={onClose} style={closeBtnStyle} aria-label="Close">✕</button>
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
                  style={searchInputStyle}
                />
              </div>

              {!isTyping ? (
                <>
                  <div
                    onClick={goToGroupCreation}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', cursor: 'pointer', borderBottom: '1px solid #F5F5F5', marginTop: '8px' }}
                  >
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#F5F5F5', border: '1.5px solid #0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                      👥
                    </div>
                    <p style={{ fontSize: '14px', fontWeight: '700', color: '#0a0a0a' }}>New Group</p>
                  </div>

                  {recentContacts.length > 0 && (
                    <p style={sectionHeaderStyle}>Recent</p>
                  )}
                  {recentContacts.map(u => (
                    <SearchResultRow key={u.id} user={u} onTap={() => handleRowTap(u)} onMenu={() => openRowMenu(u)} />
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
                      <SearchResultRow key={u.id} user={u} onTap={() => handleRowTap(u)} onMenu={() => openRowMenu(u)} />
                    ))
                  )}
                </div>
              )}

              {opening && (
                <p style={{ padding: '12px 20px', fontSize: '12px', color: '#A3A3A3' }}>Opening chat...</p>
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
                  style={searchInputStyle}
                />
              </div>

              {selectedMembers.length > 0 && (
                <>
                  {chipsRow}
                  <p style={{ padding: '8px 20px 0', fontSize: '12px', fontWeight: '600', color: '#525252' }}>
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
                <p style={{ padding: '8px 0 0', fontSize: '12px', fontWeight: '600', color: '#525252' }}>
                  {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''}
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
                  <label style={{ cursor: 'pointer', position: 'relative' }}>
                    <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Group avatar" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #0a0a0a', display: 'block' }} />
                    ) : (
                      <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#F5F5F5', border: '1.5px solid #0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px' }}>
                        📷
                      </div>
                    )}
                    <p style={{ fontSize: '12px', color: '#A3A3A3', textAlign: 'center', marginTop: '8px' }}>Add photo</p>
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
          <div style={{ flexShrink: 0, padding: '12px 20px', borderTop: '1.5px solid #0a0a0a', background: '#fff' }}>
            <button
              onClick={() => setGroupStep(2)}
              disabled={selectedMembers.length === 0}
              style={{
                width: '100%',
                padding: '12px',
                background: selectedMembers.length > 0 ? '#0a0a0a' : '#E5E5E5',
                color: selectedMembers.length > 0 ? '#fff' : '#A3A3A3',
                border: '1.5px solid #0a0a0a',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: selectedMembers.length > 0 ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                boxShadow: selectedMembers.length > 0 ? '3px 3px 0 #FFB800' : 'none',
              }}
            >
              Next →
            </button>
          </div>
        )}

        {mode === 'group' && groupStep === 2 && (
          <div style={{ flexShrink: 0, padding: '12px 20px', borderTop: '1.5px solid #0a0a0a', background: '#fff' }}>
            {error && (
              <div style={{ background: '#FEF2F2', border: '1.5px solid #EF4444', borderRadius: '8px', padding: '10px 14px', marginBottom: '10px', fontSize: '13px', color: '#EF4444' }}>
                {error}
              </div>
            )}
            <button
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || isCreating}
              style={{
                width: '100%',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: groupName.trim() ? '#0a0a0a' : '#E5E5E5',
                color: groupName.trim() ? '#fff' : '#A3A3A3',
                border: '1.5px solid #0a0a0a',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: groupName.trim() ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                boxShadow: groupName.trim() ? '3px 3px 0 #FFB800' : 'none',
              }}
            >
              {isCreating && <Spinner />}
              {isCreating ? 'Creating...' : 'Create group'}
            </button>
          </div>
        )}
      </div>

      <BottomSheet isOpen={!!menuUser} onClose={closeRowMenu}>
        <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 20px 16px', borderBottom: '1px solid #E5E5E5' }}>
            <Avatar src={menuUser?.avatar_url} name={menuUser?.display_name} size={40} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: '15px', fontWeight: '800' }}>{menuUser?.display_name}</p>
              <p style={{ fontSize: '12px', color: '#A3A3A3' }}>@{menuUser?.username}</p>
            </div>
          </div>
          <div style={{ padding: '8px 0' }}>
            <button
              style={{ ...menuRowStyle, opacity: checkingConv ? 0.5 : 1 }}
              onClick={handleMenuOpenOrRequest}
              disabled={checkingConv}
            >
              {checkingConv ? '···' : menuConvId ? '💬 Open chat' : '✉️ Send message request'}
            </button>
            <button style={menuRowStyle} onClick={handleMenuViewProfile}>👤 View profile</button>
            <button style={menuRowStyle} onClick={handleMenuShareProfile}>🔗 Share profile</button>
            <button style={{ ...menuRowStyle, color: '#EF4444' }} onClick={handleMenuBlockClick}>🚫 Block</button>
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
      background: '#FFB800',
      border: '1.5px solid #0a0a0a',
      borderRadius: '100px',
      fontSize: '13px',
      fontWeight: '600',
      flexShrink: 0,
      whiteSpace: 'nowrap',
    }}>
      <Avatar src={user.avatar_url} name={user.display_name} size={20} />
      {user.display_name}
      <button
        onClick={onRemove}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '14px', lineHeight: 1, color: '#0a0a0a', marginLeft: '2px' }}
      >×</button>
    </div>
  )
}

// Mode 1 (search/discovery): tapping the row navigates; a separate ⋯
// button opens the menu. Not nested inside a Link (unlike ChatLink
// elsewhere), so no navigation-suppression tricks are needed here.
function SearchResultRow({ user, onTap, onMenu }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderBottom: '1px solid #F5F5F5' }}>
      <div onClick={onTap} style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, cursor: 'pointer' }}>
        <Avatar src={user.avatar_url} name={user.display_name} size={40} />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '14px', fontWeight: '600', color: '#0a0a0a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.display_name}</p>
          <p style={{ fontSize: '12px', color: '#A3A3A3' }}>@{user.username}</p>
        </div>
      </div>
      <button
        onClick={onMenu}
        aria-label="More options"
        style={{ width: '36px', height: '36px', flexShrink: 0, background: 'none', border: 'none', fontSize: '18px', color: '#525252', cursor: 'pointer' }}
      >
        ⋯
      </button>
    </div>
  )
}

// Mode 2 (group creation): tapping anywhere on the row toggles selection.
function MemberSelectRow({ user, selected, onTap }) {
  return (
    <div
      onClick={onTap}
      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 20px', borderBottom: '1px solid #F5F5F5', cursor: 'pointer' }}
    >
      <Avatar src={user.avatar_url} name={user.display_name} size={40} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: '14px', fontWeight: '600', color: '#0a0a0a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.display_name}</p>
        <p style={{ fontSize: '12px', color: '#A3A3A3' }}>@{user.username}</p>
      </div>
      <div style={{
        width: '26px',
        height: '26px',
        borderRadius: '50%',
        border: `1.5px solid ${selected ? '#0a0a0a' : '#E5E5E5'}`,
        background: selected ? '#0a0a0a' : '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {selected && (
          <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
            <path d="M2 5 L4 7 L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{
      width: '14px',
      height: '14px',
      border: '2px solid rgba(255,255,255,0.4)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: 'relay-ncs-spin 0.7s linear infinite',
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
  padding: '4px 20px 12px',
  borderBottom: '1px solid #E5E5E5',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexShrink: 0,
  gap: '8px',
}

const headerTitleStyle = {
  fontSize: '16px',
  fontWeight: '800',
  color: '#0a0a0a',
}

const closeBtnStyle = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '16px',
  color: '#A3A3A3',
  padding: '8px',
}

const backBtnStyle = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '18px',
  color: '#0a0a0a',
  padding: '4px',
}

const searchInputStyle = {
  width: '100%',
  padding: '12px 14px',
  border: '1.5px solid #E5E5E5',
  borderRadius: '10px',
  fontSize: '16px',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
}

const sectionHeaderStyle = {
  fontSize: '11px',
  fontWeight: '700',
  color: '#A3A3A3',
  letterSpacing: '1px',
  textTransform: 'uppercase',
  padding: '16px 20px 4px',
}

const hintTextStyle = {
  fontSize: '13px',
  color: '#A3A3A3',
  padding: '16px 20px',
}

const fieldLabelStyle = {
  fontSize: '13px',
  fontWeight: '600',
  color: '#0a0a0a',
  display: 'block',
  marginBottom: '8px',
}

const fieldInputStyle = {
  width: '100%',
  padding: '12px 14px',
  border: '1.5px solid #E5E5E5',
  borderRadius: '8px',
  fontSize: '16px',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
}

const charCountStyle = {
  fontSize: '11px',
  color: '#A3A3A3',
  marginTop: '4px',
  textAlign: 'right',
}

const menuRowStyle = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '14px 20px',
  fontSize: '15px',
  fontWeight: '600',
  color: '#0a0a0a',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
