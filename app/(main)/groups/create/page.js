'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Avatar from '@/components/shared/Avatar'
import { createGroup } from '@/actions/groups'
import { getConversations } from '@/actions/messages'
import { searchUsers } from '@/actions/users'
import Link from 'next/link'

export default function CreateGroupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedMembers, setSelectedMembers] = useState([])
  const [recentContacts, setRecentContacts] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)

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

  const handleSearch = async (query) => {
    setSearchQuery(query)
    if (query.length < 3) { setSearchResults([]); return }
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

  const handleCreate = async () => {
    if (!name.trim()) { setError('Group name is required'); return }
    setCreating(true)
    setError(null)

    const formData = new FormData()
    formData.append('name', name)
    formData.append('description', description)
    selectedMembers.forEach(m => formData.append('memberIds', m.id))

    const result = await createGroup(formData)
    if (result.error) {
      setError(result.error)
      setCreating(false)
      return
    }

    router.push(`/chat/${result.conversationId}`)
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
    <div
      onClick={() => toggleMember(user)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 0',
        cursor: 'pointer',
        borderBottom: '1px solid #F5F5F5',
      }}
    >
      <Avatar src={user.avatar_url} name={user.display_name} size={40} />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '14px', fontWeight: '600', color: '#0a0a0a' }}>{user.display_name}</p>
        <p style={{ fontSize: '12px', color: '#A3A3A3' }}>@{user.username}</p>
      </div>
      <div style={{
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        border: `1.5px solid ${isSelected(user.id) ? '#0a0a0a' : '#E5E5E5'}`,
        background: isSelected(user.id) ? '#0a0a0a' : '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {isSelected(user.id) && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5 L4 7 L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
    </div>
  )

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1.5px solid #E5E5E5',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/chat" style={{ textDecoration: 'none', color: '#0a0a0a', fontSize: '18px' }}>←</Link>
          <h1 style={{ fontSize: '18px', fontWeight: '800' }}>New Group</h1>
        </div>
        <button
          onClick={handleCreate}
          disabled={!name.trim() || creating}
          style={{
            padding: '8px 18px',
            background: name.trim() ? '#0a0a0a' : '#E5E5E5',
            color: name.trim() ? '#fff' : '#A3A3A3',
            border: '1.5px solid #0a0a0a',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '700',
            cursor: name.trim() ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            boxShadow: name.trim() ? '2px 2px 0 #FFB800' : 'none',
          }}
        >
          {creating ? 'Creating...' : 'Create'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
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

        {/* Group name */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#0a0a0a', display: 'block', marginBottom: '8px' }}>
            Group name *
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Study Group, Family, Work Team"
            maxLength={50}
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '1.5px solid #E5E5E5',
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'inherit',
              outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = '#0a0a0a'}
            onBlur={e => e.target.style.borderColor = '#E5E5E5'}
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#0a0a0a', display: 'block', marginBottom: '8px' }}>
            Description (optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What's this group about?"
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '1.5px solid #E5E5E5',
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'inherit',
              outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = '#0a0a0a'}
            onBlur={e => e.target.style.borderColor = '#E5E5E5'}
          />
        </div>

        {/* Selected members */}
        {selectedMembers.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#0a0a0a', marginBottom: '10px' }}>
              {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {selectedMembers.map(m => <MemberChip key={m.id} user={m} />)}
            </div>
          </div>
        )}

        {/* Search */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#0a0a0a', display: 'block', marginBottom: '8px' }}>
            Add people
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search by username..."
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '1.5px solid #E5E5E5',
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'inherit',
              outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = '#0a0a0a'}
            onBlur={e => e.target.style.borderColor = '#E5E5E5'}
          />
        </div>

        {/* Search results */}
        {searchQuery.length >= 3 && (
          <div style={{ marginBottom: '24px' }}>
            {searching ? (
              <p style={{ fontSize: '13px', color: '#A3A3A3' }}>Searching...</p>
            ) : searchResults.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#A3A3A3' }}>No users found</p>
            ) : (
              searchResults.map(u => <UserRow key={u.id} user={u} />)
            )}
          </div>
        )}

        {/* Recent contacts */}
        {!searchQuery && recentContacts.length > 0 && (
          <div>
            <p style={{ fontSize: '11px', fontWeight: '700', color: '#A3A3A3', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>
              Recent
            </p>
            {recentContacts.map(u => u && <UserRow key={u.id} user={u} />)}
          </div>
        )}
      </div>
    </div>
  )
}