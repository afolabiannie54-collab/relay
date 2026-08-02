'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Avatar from '@/components/shared/Avatar'
import BottomSheet from '@/components/shared/BottomSheet'
import ConfirmSheet from '@/components/shared/ConfirmSheet'
import NewConversationSheet from '@/components/chat/NewConversationSheet'
import { searchUsers } from '@/actions/users'
import { getExistingConversation } from '@/actions/messages'
import { blockUser } from '@/actions/blocks'
import { cache } from '@/lib/cache'
import { useProfileSheet } from '@/lib/profile-sheet-context'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState(null)
  const [menuUser, setMenuUser] = useState(null)
  const [menuConvId, setMenuConvId] = useState(null)
  const [checkingConv, setCheckingConv] = useState(false)
  const [blockTarget, setBlockTarget] = useState(null)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const searchTimeout = useRef(null)
  const router = useRouter()
  const { openProfile } = useProfileSheet()

  const handleSearch = (e) => {
    const value = e.target.value
    setQuery(value)
    setError(null)

    if (searchTimeout.current) clearTimeout(searchTimeout.current)

    if (value.trim().length < 3) {
      setResults([])
      setSearched(false)
      return
    }

    setLoading(true)
    searchTimeout.current = setTimeout(async () => {
      const result = await searchUsers(value.trim())
      if (result.error) {
        setError(result.error)
        setResults([])
      } else {
        setResults(result.data || [])
        setSearched(true)
      }
      setLoading(false)
    }, 400)
  }

  const openMenu = async (user) => {
    setMenuUser(user)

    // Cached as the resolved conversationId, or `false` for "checked,
    // no DM exists" — distinct from `null`, which means never checked.
    // Avoids the Open-chat/Send-request label ever flashing the wrong
    // one before flipping to the right one on repeat opens.
    const cacheKey = `existing-dm:${user.id}`
    const cached = cache.get(cacheKey)
    if (cached !== null) {
      setMenuConvId(cached || null)
      setCheckingConv(false)
      return
    }

    setMenuConvId(null)
    setCheckingConv(true)
    const result = await getExistingConversation(user.id)
    cache.set(cacheKey, result.conversationId || false, 30000)
    setMenuConvId(result.conversationId || null)
    setCheckingConv(false)
  }

  const closeMenu = () => {
    setMenuUser(null)
    setMenuConvId(null)
    setCheckingConv(false)
  }

  const handleOpenOrRequest = () => {
    if (!menuUser) return
    const username = menuUser.username
    const convId = menuConvId
    closeMenu()
    if (convId) {
      router.push(`/chat/${convId}`)
    } else {
      openProfile(username)
    }
  }

  const handleViewProfile = () => {
    if (!menuUser) return
    const username = menuUser.username
    closeMenu()
    openProfile(username)
  }

  const handleShareProfile = async () => {
    if (!menuUser) return
    const url = `${window.location.origin}/u/${menuUser.username}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Clipboard API unavailable — nothing else to fall back to here.
    }
    closeMenu()
  }

  const handleBlockClick = () => {
    setBlockTarget(menuUser)
    closeMenu()
  }

  const confirmBlock = async () => {
    if (!blockTarget) return
    await blockUser(blockTarget.id)
    setResults(prev => prev.filter(u => u.id !== blockTarget.id))
    setBlockTarget(null)
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

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#F5F5F5',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Top nav — search is a root tab, no back button */}
      <div style={{
        background: '#fff',
        borderBottom: '1.5px solid #0a0a0a',
        padding: '16px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{
          maxWidth: '600px',
          margin: '0 auto',
        }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search by username..."
              value={query}
              onChange={handleSearch}
              autoFocus
              style={{
                width: '100%',
                padding: '10px 14px 10px 36px',
                border: '1.5px solid #0a0a0a',
                borderRadius: '8px',
                fontSize: '16px',
                fontFamily: 'inherit',
                outline: 'none',
                background: '#F5F5F5',
                color: '#0a0a0a',
              }}
            />
            <span style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#A3A3A3',
              fontSize: '14px',
              pointerEvents: 'none',
            }}>
              🔍
            </span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px 24px' }}>
        {/* New Group — always the first row above search results, only
            in the default (not-yet-typed) state, same as
            NewConversationSheet's own Mode 1 default view. */}
        {!loading && !searched && (
          <div
            onClick={() => setShowNewGroup(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '16px',
              marginBottom: '16px',
              background: '#fff',
              border: '1.5px solid #0a0a0a',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '3px 3px 0 #0a0a0a',
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#F5F5F5', border: '1.5px solid #0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
              👥
            </div>
            <p style={{ fontSize: '15px', fontWeight: '700', color: '#0a0a0a' }}>New Group</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#A3A3A3', fontSize: '14px' }}>
            Searching...
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: '#FEF2F2',
            border: '1.5px solid #EF4444',
            borderRadius: '8px',
            padding: '12px 14px',
            fontSize: '13px',
            color: '#EF4444',
          }}>
            {error}
          </div>
        )}

        {/* No results */}
        {!loading && searched && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
            <p style={{ fontSize: '16px', fontWeight: '700', marginBottom: '6px' }}>No users found</p>
            <p style={{ fontSize: '14px', color: '#A3A3A3' }}>
              No one matches "{query}". Try a different username.
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !searched && (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>👥</div>
            <p style={{ fontSize: '16px', fontWeight: '700', marginBottom: '6px' }}>Find people on Relay</p>
            <p style={{ fontSize: '14px', color: '#A3A3A3' }}>
              Search by username to find and message people.
            </p>
          </div>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ fontSize: '12px', color: '#A3A3A3', marginBottom: '4px', fontWeight: '600' }}>
              {results.length} {results.length === 1 ? 'result' : 'results'}
            </p>
            {results.map(user => (
              <div key={user.id} style={{ display: 'flex', alignItems: 'stretch', gap: '6px' }}>
                <div
                  onClick={() => openProfile(user.username)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: '#fff',
                    border: '1.5px solid #0a0a0a',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    transition: 'box-shadow 0.15s, transform 0.15s',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                    onMouseEnter={e => {
                      e.currentTarget.style.boxShadow = '3px 3px 0 #0a0a0a'
                      e.currentTarget.style.transform = 'translate(-1px, -1px)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.boxShadow = 'none'
                      e.currentTarget.style.transform = 'translate(0, 0)'
                    }}
                  >
                    <Avatar
                      src={user.avatar_url}
                      name={user.display_name}
                      size={48}
                    />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '15px', fontWeight: '700', color: '#0a0a0a', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.display_name}
                      </p>
                      <p style={{ fontSize: '13px', color: '#A3A3A3' }}>@{user.username}</p>
                    </div>
                  </div>
                <button
                  onClick={() => openMenu(user)}
                  aria-label="More options"
                  style={{
                    width: '44px',
                    flexShrink: 0,
                    background: '#fff',
                    border: '1.5px solid #0a0a0a',
                    borderRadius: '12px',
                    fontSize: '18px',
                    color: '#0a0a0a',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  ⋯
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomSheet isOpen={!!menuUser} onClose={closeMenu}>
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
              onClick={handleOpenOrRequest}
              disabled={checkingConv}
            >
              {checkingConv ? '···' : menuConvId ? '💬 Open chat' : '✉️ Send message request'}
            </button>
            <button style={menuRowStyle} onClick={handleViewProfile}>👤 View profile</button>
            <button style={menuRowStyle} onClick={handleShareProfile}>🔗 Share profile</button>
            <button style={{ ...menuRowStyle, color: '#EF4444' }} onClick={handleBlockClick}>🚫 Block</button>
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

      <NewConversationSheet
        isOpen={showNewGroup}
        onClose={() => setShowNewGroup(false)}
        initialMode="group"
      />
    </div>
  )
}
