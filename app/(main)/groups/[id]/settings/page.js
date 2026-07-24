'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Avatar from '@/components/shared/Avatar'
import {
  getGroupInfo,
  updateGroupInfo,
  uploadGroupAvatar,
  addMember,
  removeMember,
  leaveGroup,
  deleteGroup,
  promoteToAdmin,
  demoteAdmin,
} from '@/actions/groups'
import { searchUsers } from '@/actions/users'

export default function GroupSettingsPage() {
  const { id } = useParams()
  const router = useRouter()
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [acting, setActing] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    const result = await getGroupInfo(id)
    if (result.data) {
      setGroup(result.data)
      console.log('myRole:', result.data.myRole)
      setFormData({ name: result.data.name, description: result.data.description || '' })
    }
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    const data = new FormData()
    data.append('name', formData.name)
    data.append('description', formData.description)
    const result = await updateGroupInfo(id, data)
    if (result.error) setError(result.error)
    else { setSuccess('Group updated.'); load() }
    setSaving(false)
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setActing('avatar')
    const data = new FormData()
    data.append('avatar', file)
    const result = await uploadGroupAvatar(id, data)
    if (result.error) setError(result.error)
    else { setSuccess('Photo updated.'); load() }
    setActing(null)
  }

  const handleSearch = async (query) => {
    setSearchQuery(query)
    if (query.length < 3) { setSearchResults([]); return }
    setSearching(true)
    const result = await searchUsers(query)
    if (result.data) {
      const memberIds = group?.members?.map(m => m.user_id) || []
      setSearchResults(result.data.filter(u => !memberIds.includes(u.id)))
    }
    setSearching(false)
  }

  const handleAddMember = async (userId) => {
    setActing(userId)
    const result = await addMember(id, userId)
    if (result.error) setError(result.error)
    else { setSuccess('Member added.'); load(); setSearchQuery(''); setSearchResults([]) }
    setActing(null)
  }

  const handleRemoveMember = async (userId) => {
    if (!confirm('Remove this member?')) return
    setActing(userId)
    const result = await removeMember(id, userId)
    if (result.error) setError(result.error)
    else { load() }
    setActing(null)
  }

  const handlePromote = async (userId) => {
    setActing(userId)
    const result = await promoteToAdmin(id, userId)
    if (result.error) setError(result.error)
    else load()
    setActing(null)
  }

  const handleDemote = async (userId) => {
    setActing(userId)
    const result = await demoteAdmin(id, userId)
    if (result.error) setError(result.error)
    else load()
    setActing(null)
  }

  const handleLeave = async () => {
    if (!confirm('Leave this group?')) return
    const result = await leaveGroup(id)
    if (result.error) setError(result.error)
    else router.push('/chat')
  }

  const handleDelete = async () => {
    if (!confirm('Delete this group permanently? This cannot be undone.')) return
    const result = await deleteGroup(id)
    if (result.error) setError(result.error)
    else router.push('/chat')
  }

  const getRoleBadge = (role) => {
    if (role === 'owner') return (
      <span style={{
        padding: '2px 8px',
        background: '#FFB800',
        border: '1px solid #0a0a0a',
        borderRadius: '100px',
        fontSize: '10px',
        fontWeight: '700',
      }}>Owner</span>
    )
    if (role === 'admin') return (
      <span style={{
        padding: '2px 8px',
        background: '#F5F5F5',
        border: '1px solid #0a0a0a',
        borderRadius: '100px',
        fontSize: '10px',
        fontWeight: '700',
      }}>Admin</span>
    )
    return null
  }

  if (loading) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}>
        <p style={{ color: '#A3A3A3', fontSize: '14px' }}>Loading...</p>
      </div>
    )
  }

  const isAdminOrOwner = ['admin', 'owner'].includes(group?.myRole)
  const isOwner = group?.myRole === 'owner'

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: '#F5F5F5',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1.5px solid #E5E5E5',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <Link href={`/chat/${id}`} style={{ textDecoration: 'none', color: '#0a0a0a', fontSize: '18px' }}>←</Link>
        <h1 style={{ fontSize: '18px', fontWeight: '800' }}>Group Settings</h1>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
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

        {success && (
          <div style={{
            background: '#F0FDF4',
            border: '1.5px solid #22C55E',
            borderRadius: '8px',
            padding: '12px 14px',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#22C55E',
          }}>
            {success}
          </div>
        )}

        {/* Group photo */}
        <div style={{
          background: '#fff',
          border: '1.5px solid #0a0a0a',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '4px 4px 0 #0a0a0a',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          <Avatar src={group?.avatar_url} name={group?.name} size={64} />
          {isAdminOrOwner && (
            <div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={acting === 'avatar'}
                style={{
                  padding: '8px 16px',
                  background: '#0a0a0a',
                  color: '#fff',
                  border: '1.5px solid #0a0a0a',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '2px 2px 0 #FFB800',
                  display: 'block',
                  marginBottom: '6px',
                }}
              >
                {acting === 'avatar' ? 'Uploading...' : 'Change photo'}
              </button>
              <p style={{ fontSize: '11px', color: '#A3A3A3' }}>Max 5MB</p>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
        </div>

        {/* Group info */}
        {isAdminOrOwner && (
          <div style={{
            background: '#fff',
            border: '1.5px solid #0a0a0a',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '4px 4px 0 #0a0a0a',
            marginBottom: '16px',
          }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px' }}>Group info</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
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
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
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
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '10px',
                  background: '#0a0a0a',
                  color: '#fff',
                  border: '1.5px solid #0a0a0a',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '2px 2px 0 #FFB800',
                }}
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        )}

        {/* Members */}
        <div style={{
          background: '#fff',
          border: '1.5px solid #0a0a0a',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '4px 4px 0 #0a0a0a',
          marginBottom: '16px',
        }}>
          <h2 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px' }}>
            Members ({group?.members?.length || 0})
          </h2>

          {isAdminOrOwner && (
            <div style={{ marginBottom: '16px' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search to add members..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1.5px solid #E5E5E5',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  outline: 'none',
                  marginBottom: '8px',
                }}
                onFocus={e => e.target.style.borderColor = '#0a0a0a'}
                onBlur={e => e.target.style.borderColor = '#E5E5E5'}
              />
              {searchQuery.length >= 3 && (
                <div>
                  {searching ? (
                    <p style={{ fontSize: '13px', color: '#A3A3A3' }}>Searching...</p>
                  ) : searchResults.map(u => (
                    <div key={u.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 0',
                      borderBottom: '1px solid #F5F5F5',
                    }}>
                      <Avatar src={u.avatar_url} name={u.display_name} size={36} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '14px', fontWeight: '600' }}>{u.display_name}</p>
                        <p style={{ fontSize: '12px', color: '#A3A3A3' }}>@{u.username}</p>
                      </div>
                      <button
                        onClick={() => handleAddMember(u.id)}
                        disabled={acting === u.id}
                        style={{
                          padding: '6px 12px',
                          background: '#0a0a0a',
                          color: '#fff',
                          border: '1.5px solid #0a0a0a',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {group?.members?.map(member => (
            <div key={member.user_id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 0',
              borderBottom: '1px solid #F5F5F5',
            }}>
              <Avatar src={member.avatar_url} name={member.display_name} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <p style={{ fontSize: '14px', fontWeight: '600' }}>{member.display_name}</p>
                  {getRoleBadge(member.role)}
                </div>
                <p style={{ fontSize: '12px', color: '#A3A3A3' }}>@{member.username}</p>
              </div>
              {isOwner && member.role !== 'owner' && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  {member.role === 'member' && (
                    <button
                      onClick={() => handlePromote(member.user_id)}
                      disabled={acting === member.user_id}
                      style={{
                        padding: '5px 10px',
                        background: '#fff',
                        color: '#0a0a0a',
                        border: '1.5px solid #0a0a0a',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Make admin
                    </button>
                  )}
                  {member.role === 'admin' && (
                    <button
                      onClick={() => handleDemote(member.user_id)}
                      disabled={acting === member.user_id}
                      style={{
                        padding: '5px 10px',
                        background: '#fff',
                        color: '#525252',
                        border: '1.5px solid #E5E5E5',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Demote
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveMember(member.user_id)}
                    disabled={acting === member.user_id}
                    style={{
                      padding: '5px 10px',
                      background: '#fff',
                      color: '#EF4444',
                      border: '1.5px solid #EF4444',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Danger zone */}
        <div style={{
          background: '#fff',
          border: '1.5px solid #EF4444',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '16px',
        }}>
          <h2 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px', color: '#EF4444' }}>Danger zone</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={handleLeave}
              style={{
                padding: '10px',
                background: '#fff',
                color: '#EF4444',
                border: '1.5px solid #EF4444',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
              }}
            >
              Leave group
            </button>
            {isOwner && (
              <button
                onClick={handleDelete}
                style={{
                  padding: '10px',
                  background: '#EF4444',
                  color: '#fff',
                  border: '1.5px solid #EF4444',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                }}
              >
                Delete group
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}