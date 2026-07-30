'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BottomSheet from '@/components/shared/BottomSheet'
import Avatar from '@/components/shared/Avatar'
import { getConversations, getExistingConversation } from '@/actions/messages'
import { createGroup, uploadGroupAvatar } from '@/actions/groups'
import { searchUsers } from '@/actions/users'
import { cache } from '@/lib/cache'

const GROUP_NAME_MAX = 50
const GROUP_DESCRIPTION_MAX = 200

export default function NewConversationSheet({ isOpen, onClose }) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [selectedMembers, setSelectedMembers] = useState([])
  const [recentContacts, setRecentContacts] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [opening, setOpening] = useState(false)

  const [groupName, setGroupName] = useState('')
  const [groupDescription, setGroupDescription] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)

  // Reset to a clean slate every time the sheet opens, rather than
  // leaving stale selections from a previous open.
  useEffect(() => {
    if (!isOpen) return
    setStep(1)
    setSelectedMembers([])
    setSearchQuery('')
    setSearchResults([])
    setGroupName('')
    setGroupDescription('')
    setAvatarFile(null)
    setAvatarPreview(null)
    setError(null)

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
  }, [isOpen])

  const handleSearch = async (query) => {
    setSearchQuery(query)
    if (query.trim().length < 3) { setSearchResults([]); return }
    setSearching(true)
    const result = await searchUsers(query)
    if (result.data) setSearchResults(result.data)
    setSearching(false)
  }

  const toggleMember = (user) => {
    setSelectedMembers(prev => {
      const exists = prev.find(m => m.id === user.id)
      if (exists) return prev.filter(m => m.id !== user.id)
      return [...prev, user]
    })
  }

  const isSelected = (userId) => selectedMembers.some(m => m.id === userId)

  // Tapping a contact's name (not their checkbox) while nobody else is
  // selected opens straight into the DM — the checkbox is only for
  // building up a multi-select (either "start group" or carrying members
  // into the group step). Once a multi-select is already in progress,
  // tapping the name just toggles selection like the checkbox does.
  const handleNameTap = async (user) => {
    if (selectedMembers.length > 0) {
      toggleMember(user)
      return
    }

    // Cached as the resolved conversationId, or `false` for "checked, no
    // DM exists" — distinct from `null` (never checked) — so tapping the
    // same recent contact twice doesn't redo the round trip.
    const cacheKey = `existing-dm:${user.id}`
    const cached = cache.get(cacheKey)
    let conversationId
    if (cached !== null) {
      conversationId = cached || null
    } else {
      setOpening(true)
      const existing = await getExistingConversation(user.id)
      setOpening(false)
      conversationId = existing.conversationId || null
      cache.set(cacheKey, conversationId || false, 30000)
    }

    if (conversationId) {
      router.push(`/chat/${conversationId}`)
    } else {
      router.push(`/u/${user.username}`)
    }
    onClose?.()
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleCreateGroup = async () => {
    if (!groupName.trim()) { setError('Group name is required'); return }
    setCreating(true)
    setError(null)

    const formData = new FormData()
    formData.append('name', groupName.trim().slice(0, GROUP_NAME_MAX))
    formData.append('description', groupDescription.trim().slice(0, GROUP_DESCRIPTION_MAX))
    selectedMembers.forEach(m => formData.append('memberIds', m.id))

    const result = await createGroup(formData)
    if (result.error) {
      setError(result.error)
      setCreating(false)
      return
    }

    if (avatarFile) {
      const avatarFormData = new FormData()
      avatarFormData.append('avatar', avatarFile)
      await uploadGroupAvatar(result.conversationId, avatarFormData)
    }

    try {
      window.navigator.vibrate?.(10)
    } catch {}

    router.push(`/chat/${result.conversationId}`)
    onClose?.()
  }

  const MemberChip = ({ user }) => (
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
    }}>
      <Avatar src={user.avatar_url} name={user.display_name} size={20} />
      {user.display_name}
      <button
        onClick={() => toggleMember(user)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0',
          fontSize: '14px',
          lineHeight: 1,
          color: '#0a0a0a',
          marginLeft: '2px',
        }}
      >×</button>
    </div>
  )

  const UserRow = ({ user }) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '10px 20px',
      borderBottom: '1px solid #F5F5F5',
    }}>
      <div
        onClick={() => handleNameTap(user)}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, cursor: 'pointer' }}
      >
        <Avatar src={user.avatar_url} name={user.display_name} size={40} />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '14px', fontWeight: '600', color: '#0a0a0a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.display_name}</p>
          <p style={{ fontSize: '12px', color: '#A3A3A3' }}>@{user.username}</p>
        </div>
      </div>
      <button
        onClick={() => toggleMember(user)}
        aria-label="Select"
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          border: `1.5px solid ${isSelected(user.id) ? '#0a0a0a' : '#E5E5E5'}`,
          background: isSelected(user.id) ? '#0a0a0a' : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          cursor: 'pointer',
        }}
      >
        {isSelected(user.id) && (
          <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
            <path d="M2 5 L4 7 L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
    </div>
  )

  const listToShow = searchQuery.trim().length >= 3 ? searchResults : recentContacts

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      {step === 1 ? (
        <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
          <div style={{
            padding: '4px 20px 12px',
            borderBottom: '1px solid #E5E5E5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0a0a0a' }}>New conversation</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#A3A3A3', padding: '8px' }} aria-label="Close">✕</button>
          </div>

          <div style={{ padding: '12px 20px 0' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
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
              }}
            />
          </div>

          {selectedMembers.length > 0 && (
            <div style={{ padding: '12px 20px 0', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {selectedMembers.map(m => <MemberChip key={m.id} user={m} />)}
            </div>
          )}

          <div
            onClick={() => setStep(2)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 20px',
              cursor: 'pointer',
              borderBottom: '1px solid #F5F5F5',
              marginTop: '8px',
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#F5F5F5',
              border: '1.5px solid #0a0a0a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              flexShrink: 0,
            }}>
              👥
            </div>
            <p style={{ fontSize: '14px', fontWeight: '700', color: '#0a0a0a' }}>New Group</p>
          </div>

          <div style={{ paddingBottom: selectedMembers.length >= 2 ? '80px' : '8px' }}>
            {searchQuery.trim().length >= 3 ? (
              searching ? (
                <p style={{ fontSize: '13px', color: '#A3A3A3', padding: '16px 20px' }}>Searching...</p>
              ) : searchResults.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#A3A3A3', padding: '16px 20px' }}>No users found</p>
              ) : (
                searchResults.map(u => <UserRow key={u.id} user={u} />)
              )
            ) : (
              <>
                {recentContacts.length > 0 && (
                  <p style={{ fontSize: '11px', fontWeight: '700', color: '#A3A3A3', letterSpacing: '1px', textTransform: 'uppercase', padding: '12px 20px 4px' }}>
                    Recent
                  </p>
                )}
                {recentContacts.map(u => u && <UserRow key={u.id} user={u} />)}
              </>
            )}
          </div>

          {selectedMembers.length >= 2 && (
            <div style={{
              position: 'sticky',
              bottom: 0,
              padding: '12px 20px',
              background: '#fff',
              borderTop: '1.5px solid #0a0a0a',
            }}>
              <button
                onClick={() => setStep(2)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#0a0a0a',
                  color: '#fff',
                  border: '1.5px solid #0a0a0a',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '3px 3px 0 #FFB800',
                }}
              >
                Start group ({selectedMembers.length})
              </button>
            </div>
          )}

          {opening && (
            <div style={{ padding: '12px 20px', fontSize: '12px', color: '#A3A3A3' }}>Opening chat...</div>
          )}
        </div>
      ) : (
        <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
          <div style={{
            padding: '4px 20px 12px',
            borderBottom: '1px solid #E5E5E5',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#0a0a0a', padding: '4px' }} aria-label="Back">←</button>
            <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0a0a0a', flex: 1 }}>New group</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#A3A3A3', padding: '8px' }} aria-label="Close">✕</button>
          </div>

          <div style={{ padding: '20px' }}>
            {error && (
              <div style={{
                background: '#FEF2F2',
                border: '1.5px solid #EF4444',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#EF4444',
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <label style={{ cursor: 'pointer', position: 'relative' }}>
                <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Group avatar" style={{
                    width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover',
                    border: '1.5px solid #0a0a0a',
                  }} />
                ) : (
                  <div style={{
                    width: '72px', height: '72px', borderRadius: '50%',
                    background: '#F5F5F5', border: '1.5px solid #0a0a0a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '24px',
                  }}>
                    📷
                  </div>
                )}
              </label>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#0a0a0a', display: 'block', marginBottom: '8px' }}>
                Group name *
              </label>
              <input
                type="text"
                value={groupName}
                onChange={e => setGroupName(e.target.value.slice(0, GROUP_NAME_MAX))}
                placeholder="e.g. Study Group, Family, Work Team"
                maxLength={GROUP_NAME_MAX}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1.5px solid #E5E5E5',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {groupName.length >= GROUP_NAME_MAX * 0.8 && (
                <p style={{ fontSize: '11px', color: '#A3A3A3', marginTop: '4px', textAlign: 'right' }}>
                  {groupName.length}/{GROUP_NAME_MAX}
                </p>
              )}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#0a0a0a', display: 'block', marginBottom: '8px' }}>
                Description (optional)
              </label>
              <input
                type="text"
                value={groupDescription}
                onChange={e => setGroupDescription(e.target.value.slice(0, GROUP_DESCRIPTION_MAX))}
                placeholder="What's this group about?"
                maxLength={GROUP_DESCRIPTION_MAX}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1.5px solid #E5E5E5',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {groupDescription.length >= GROUP_DESCRIPTION_MAX * 0.8 && (
                <p style={{ fontSize: '11px', color: '#A3A3A3', marginTop: '4px', textAlign: 'right' }}>
                  {groupDescription.length}/{GROUP_DESCRIPTION_MAX}
                </p>
              )}
            </div>

            {selectedMembers.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#0a0a0a', marginBottom: '10px' }}>
                  {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {selectedMembers.map(m => <MemberChip key={m.id} user={m} />)}
                </div>
              </div>
            )}

            <button
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || creating}
              style={{
                width: '100%',
                padding: '12px',
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
              {creating ? 'Creating...' : 'Create group'}
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  )
}
