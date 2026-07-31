'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Avatar from '@/components/shared/Avatar'
import BottomSheet from '@/components/shared/BottomSheet'
import ConfirmSheet from '@/components/shared/ConfirmSheet'
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
import { getMuteStatus, muteConversation, unmuteConversation } from '@/actions/conversations'

const GROUP_NAME_MAX = 50
const GROUP_DESCRIPTION_MAX = 200

export default function GroupSettingsPage() {
  const { id } = useParams()
  const router = useRouter()
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [savedFormData, setSavedFormData] = useState({ name: '', description: '' })
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [acting, setActing] = useState(null)
  const [showAddMember, setShowAddMember] = useState(false)
  const [memberActionUser, setMemberActionUser] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
  const [muteStatus, setMuteStatus] = useState({ muted: false, mutedUntil: null })
  const [muting, setMuting] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    load()
    async function loadMute() {
      const result = await getMuteStatus(id)
      setMuteStatus(result)
    }
    loadMute()
  }, [id])

  async function load() {
    const result = await getGroupInfo(id)
    if (result.data) {
      setGroup(result.data)
      const next = { name: result.data.name, description: result.data.description || '' }
      setFormData(next)
      setSavedFormData(next)
    }
    setLoading(false)
  }

  const isDirty = formData.name !== savedFormData.name || formData.description !== savedFormData.description

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    const data = new FormData()
    data.append('name', formData.name.trim().slice(0, GROUP_NAME_MAX))
    data.append('description', formData.description.trim().slice(0, GROUP_DESCRIPTION_MAX))
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
    if (query.trim().length < 3) { setSearchResults([]); return }
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
    if (!result.error) { load(); setSearchQuery(''); setSearchResults([]); setShowAddMember(false) }
    setActing(null)
  }

  const handleRemoveMember = async () => {
    if (!memberActionUser) return
    setActing(memberActionUser.user_id)
    await removeMember(id, memberActionUser.user_id)
    setActing(null)
    setMemberActionUser(null)
    load()
  }

  const handlePromote = async (userId) => {
    setActing(userId)
    await promoteToAdmin(id, userId)
    setActing(null)
    setMemberActionUser(null)
    load()
  }

  const handleDemote = async (userId) => {
    setActing(userId)
    await demoteAdmin(id, userId)
    setActing(null)
    setMemberActionUser(null)
    load()
  }

  const handleToggleMute = async () => {
    setMuting(true)
    if (muteStatus.muted) {
      await unmuteConversation(id)
      setMuteStatus({ muted: false, mutedUntil: null })
    } else {
      await muteConversation(id, null)
      setMuteStatus({ muted: true, mutedUntil: null })
    }
    setMuting(false)
  }

  const handleLeave = async () => {
    const result = await leaveGroup(id)
    if (result.error) setError(result.error)
    else {
      window.dispatchEvent(new Event('relay:conversations-changed'))
      router.push('/chat')
    }
  }

  const handleDelete = async () => {
    const result = await deleteGroup(id)
    if (result.error) setError(result.error)
    else {
      window.dispatchEvent(new Event('relay:conversations-changed'))
      router.push('/chat')
    }
  }

  const getRoleBadge = (role) => {
    if (role === 'owner') return (
      <span style={{ padding: '2px 8px', background: '#FFB800', border: '1px solid #0a0a0a', borderRadius: '100px', fontSize: '10px', fontWeight: '700' }}>Owner</span>
    )
    if (role === 'admin') return (
      <span style={{ padding: '2px 8px', background: '#F5F5F5', border: '1px solid #0a0a0a', borderRadius: '100px', fontSize: '10px', fontWeight: '700' }}>Admin</span>
    )
    return null
  }

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', -apple-system, sans-serif" }}>
        <p style={{ color: '#A3A3A3', fontSize: '14px' }}>Loading...</p>
      </div>
    )
  }

  const isAdminOrOwner = ['admin', 'owner'].includes(group?.myRole)
  const isOwner = group?.myRole === 'owner'
  const rowStyle = {
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

  return (
    <div style={{ height: '100%', overflowY: 'auto', fontFamily: "'Inter', -apple-system, sans-serif", background: '#F5F5F5' }}>
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
          <div style={{ background: '#FEF2F2', border: '1.5px solid #EF4444', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', fontSize: '13px', color: '#EF4444' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ background: '#F0FDF4', border: '1.5px solid #22C55E', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', fontSize: '13px', color: '#22C55E' }}>
            {success}
          </div>
        )}

        {/* Group info */}
        <div style={{ background: '#fff', border: '1.5px solid #0a0a0a', borderRadius: '16px', padding: '20px', boxShadow: '4px 4px 0 #0a0a0a', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: isAdminOrOwner ? '20px' : 0 }}>
            <div style={{ position: 'relative' }}>
              <Avatar src={group?.avatar_url} name={group?.name} size={64} />
              {isAdminOrOwner && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={acting === 'avatar'}
                  aria-label="Change group photo"
                  style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: '#0a0a0a', color: '#fff', border: '1.5px solid #fff',
                    fontSize: '11px', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  📷
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
            </div>
            <div>
              <p style={{ fontSize: '16px', fontWeight: '800' }}>{group?.name}</p>
              <p style={{ fontSize: '12px', color: '#A3A3A3' }}>{group?.members?.length || 0} members</p>
            </div>
          </div>

          {isAdminOrOwner && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value.slice(0, GROUP_NAME_MAX) }))}
                  maxLength={GROUP_NAME_MAX}
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E5E5E5', borderRadius: '8px', fontSize: '16px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                />
                {formData.name.length >= GROUP_NAME_MAX * 0.8 && (
                  <p style={{ fontSize: '11px', color: formData.name.length >= GROUP_NAME_MAX ? '#EF4444' : '#A3A3A3', textAlign: 'right', marginTop: '4px' }}>
                    {formData.name.length}/{GROUP_NAME_MAX}
                  </p>
                )}
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value.slice(0, GROUP_DESCRIPTION_MAX) }))}
                  placeholder="Optional"
                  maxLength={GROUP_DESCRIPTION_MAX}
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E5E5E5', borderRadius: '8px', fontSize: '16px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                />
                {formData.description.length >= GROUP_DESCRIPTION_MAX * 0.8 && (
                  <p style={{ fontSize: '11px', color: formData.description.length >= GROUP_DESCRIPTION_MAX ? '#EF4444' : '#A3A3A3', textAlign: 'right', marginTop: '4px' }}>
                    {formData.description.length}/{GROUP_DESCRIPTION_MAX}
                  </p>
                )}
              </div>
              {isDirty && (
                <button
                  onClick={handleSave}
                  disabled={saving || !formData.name.trim()}
                  style={{ padding: '10px', background: '#0a0a0a', color: '#fff', border: '1.5px solid #0a0a0a', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '2px 2px 0 #FFB800' }}
                >
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Members */}
        <div style={{ background: '#fff', border: '1.5px solid #0a0a0a', borderRadius: '16px', padding: '20px', boxShadow: '4px 4px 0 #0a0a0a', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700' }}>{group?.members?.length || 0} members</h2>
            {isAdminOrOwner && (
              <button
                onClick={() => setShowAddMember(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: '#0a0a0a', fontFamily: 'inherit' }}
              >
                + Add member
              </button>
            )}
          </div>

          {group?.members?.map(member => (
            <div
              key={member.user_id}
              onClick={() => member.role !== 'owner' || isOwner ? setMemberActionUser(member) : null}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid #F5F5F5', cursor: 'pointer' }}
            >
              <Avatar src={member.avatar_url} name={member.display_name} size={40} />
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

        {/* Actions */}
        <div style={{ background: '#fff', border: '1.5px solid #0a0a0a', borderRadius: '16px', overflow: 'hidden', boxShadow: '4px 4px 0 #0a0a0a', marginBottom: '16px' }}>
          <button style={rowStyle} onClick={handleToggleMute} disabled={muting}>
            {muteStatus.muted ? '🔔 Unmute group' : '🔕 Mute group'}
          </button>
          <button style={{ ...rowStyle, color: '#EF4444', borderTop: '1px solid #F5F5F5' }} onClick={() => setConfirmAction('leave')}>
            🚪 Leave group
          </button>
          {isOwner && (
            <button style={{ ...rowStyle, color: '#EF4444', borderTop: '1px solid #F5F5F5' }} onClick={() => setConfirmAction('delete')}>
              🗑️ Delete group
            </button>
          )}
        </div>
      </div>

      {/* Add member sheet */}
      <BottomSheet isOpen={showAddMember} onClose={() => setShowAddMember(false)} title="Add member">
        <div style={{ padding: '12px 20px 20px', fontFamily: "'Inter', -apple-system, sans-serif" }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search by username..."
            style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #E5E5E5', borderRadius: '10px', fontSize: '16px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }}
          />
          {searching ? (
            <p style={{ fontSize: '13px', color: '#A3A3A3' }}>Searching...</p>
          ) : searchResults.length === 0 && searchQuery.trim().length >= 3 ? (
            <p style={{ fontSize: '13px', color: '#A3A3A3' }}>No users found</p>
          ) : (
            searchResults.map(u => (
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

      {/* Per-member action sheet */}
      <BottomSheet isOpen={!!memberActionUser} onClose={() => setMemberActionUser(null)}>
        <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 20px 16px', borderBottom: '1px solid #E5E5E5' }}>
            <Avatar src={memberActionUser?.avatar_url} name={memberActionUser?.display_name} size={40} />
            <p style={{ fontSize: '15px', fontWeight: '800' }}>{memberActionUser?.display_name}</p>
          </div>
          <div style={{ padding: '8px 0' }}>
            <Link
              href={`/u/${memberActionUser?.username}?from=conversation-settings&convId=${id}`}
              style={{ ...rowStyle, textDecoration: 'none', display: 'block' }}
            >
              View profile
            </Link>
            {isOwner && memberActionUser?.role === 'member' && (
              <button style={rowStyle} onClick={() => handlePromote(memberActionUser.user_id)}>Promote to admin</button>
            )}
            {isOwner && memberActionUser?.role === 'admin' && (
              <button style={rowStyle} onClick={() => handleDemote(memberActionUser.user_id)}>Demote to member</button>
            )}
            {isAdminOrOwner && memberActionUser?.role !== 'owner' && (
              <button style={{ ...rowStyle, color: '#EF4444' }} onClick={handleRemoveMember}>Remove from group</button>
            )}
          </div>
        </div>
      </BottomSheet>

      <ConfirmSheet
        isOpen={confirmAction === 'leave'}
        onClose={() => setConfirmAction(null)}
        title="Leave group?"
        message="You'll no longer receive messages from this group. You can be re-added by another member."
        confirmLabel="Leave group"
        confirmStyle="danger"
        onConfirm={handleLeave}
      />
      <ConfirmSheet
        isOpen={confirmAction === 'delete'}
        onClose={() => setConfirmAction(null)}
        title="Delete group?"
        message="This permanently deletes the group for everyone. This cannot be undone."
        confirmLabel="Delete group"
        confirmStyle="danger"
        onConfirm={handleDelete}
      />
    </div>
  )
}
