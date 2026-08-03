'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search as SearchIcon, Users, MoreHorizontal, MessageCircle, Send, User, Share2, UserX,
} from 'lucide-react'
import Avatar from '@/components/shared/Avatar'
import BottomSheet from '@/components/shared/BottomSheet'
import ConfirmSheet from '@/components/shared/ConfirmSheet'
import NewConversationSheet from '@/components/chat/NewConversationSheet'
import NotionDoodle from '@/components/shared/illustrations/NotionDoodle'
import { searchUsers } from '@/actions/users'
import { getExistingConversation } from '@/actions/messages'
import { blockUser } from '@/actions/blocks'
import { cache } from '@/lib/cache'
import { useProfileSheet } from '@/lib/profile-sheet-context'

const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

const USERS_PATH = "M11.4969 13.1102C11.6427 13.0903 15.1734 12.6577 15.0264 9.64158C15.0129 9.36446 14.9752 9.11237 14.9167 8.88385M11.4969 13.1102C13.4321 12.9927 14.4155 12.2965 14.8556 11.4622M11.4969 13.1102C11.2628 13.1421 11.0213 13.1395 10.7824 13.1048M14.9167 8.88385C14.8435 8.59774 14.7376 8.34858 14.6053 8.1335M14.9167 8.88385C15.1804 9.5545 15.3184 10.5847 14.8556 11.4622M14.6053 8.1335C13.5214 6.37016 10.6706 6.89695 9.58509 8.1335C9.15914 8.61912 8.26642 9.85067 8.70147 11.3901C8.97418 12.3551 9.85893 12.9705 10.7824 13.1048M14.6053 8.1335C15.0178 8.66563 15.6163 9.91179 15.1046 11.0419M14.8556 11.4622C14.958 11.3251 15.0401 11.1844 15.1046 11.0419M10.7824 13.1048C12.0036 13.2999 14.5776 13.1605 15.1046 11.0419M17.909 17.1618L18.1716 17.6441C18.489 18.2271 18.6332 18.9034 18.343 19.4983M17.909 17.1618C17.3401 16.1169 16.1772 15.4568 14.9051 15.4568H8.98108C7.709 15.4568 6.5461 16.1169 5.97721 17.1618L5.84836 17.3984C5.45002 18.1301 5.35258 18.9939 5.77147 19.7158C7.05001 21.9192 9.26061 22.8618 11.4969 22.9183M17.909 17.1618C18.4928 18.7179 18.0277 22.0477 11.4969 22.9183M18.343 19.4983C17.3269 21.5809 14.3904 22.9913 11.4969 22.9183M18.343 19.4983C18.0599 20.8786 16.2944 23.495 11.4969 22.9183M5.2827 5.60616C5.38685 5.59117 7.90831 5.2651 7.80329 2.99136C7.79364 2.78245 7.76676 2.59241 7.72498 2.42014M5.2827 5.60616C6.66473 5.51763 7.36701 4.99281 7.6813 4.36382M5.2827 5.60616C5.11549 5.63023 4.94305 5.62831 4.77246 5.60212M7.72498 2.42014C7.67268 2.20446 7.59703 2.01663 7.5026 1.85449M7.72498 2.42014C7.91327 2.92572 8.01182 3.70237 7.6813 4.36382M7.5026 1.85449C6.72848 0.525196 4.69262 0.922319 3.91738 1.85449C3.61318 2.22057 2.97565 3.14898 3.28634 4.30949C3.48109 5.03696 4.11294 5.50089 4.77246 5.60212M7.5026 1.85449C7.79717 2.25564 8.22455 3.19506 7.85917 4.04701M7.6813 4.36382C7.75443 4.26045 7.8131 4.15442 7.85917 4.04701M4.77246 5.60212C5.64455 5.74919 7.48283 5.64407 7.85917 4.04701M6 7.3752H3.48602C2.57756 7.3752 1.74708 7.87278 1.3408 8.66048L1.24878 8.83889C0.964309 9.39044 0.894717 10.0417 1.19387 10.5859M18.7173 5.60616C18.6131 5.59117 16.0917 5.2651 16.1967 2.99136C16.2064 2.78245 16.2332 2.59241 16.275 2.42014M18.7173 5.60616C17.3353 5.51763 16.633 4.99281 16.3187 4.36382M18.7173 5.60616C18.8845 5.63023 19.057 5.62831 19.2275 5.60212M16.275 2.42014C16.3273 2.20446 16.403 2.01663 16.4974 1.85449M16.275 2.42014C16.0867 2.92572 15.9882 3.70237 16.3187 4.36382M16.4974 1.85449C17.2715 0.525196 19.3074 0.922319 20.0826 1.85449C20.3868 2.22057 21.0244 3.14898 20.7137 4.30949C20.5189 5.03696 19.8871 5.50089 19.2275 5.60212M16.4974 1.85449C16.2028 2.25564 15.7754 3.19506 16.1408 4.04701M16.3187 4.36382C16.2456 4.26045 16.1869 4.15442 16.1408 4.04701M19.2275 5.60212C18.3554 5.74919 16.5172 5.64407 16.1408 4.04701M18 7.3752H20.514C21.4224 7.3752 22.2529 7.87278 22.6592 8.66048L22.7512 8.83889C23.0357 9.39044 23.1053 10.0417 22.8061 10.5859"
const USER_SLASH_PATH = "M11.3034 9.40148C11.5053 9.37414 16.394 8.7794 16.1904 4.63217C16.1717 4.25113 16.1195 3.90451 16.0385 3.59029M11.3034 9.40148C13.9829 9.24001 15.3445 8.28275 15.9539 7.1355M11.3034 9.40148C10.9792 9.44538 10.6449 9.44188 10.3141 9.39412M16.0385 3.59029C15.9371 3.1969 15.7905 2.8543 15.6074 2.55856M16.0385 3.59029C16.4036 4.51244 16.5947 5.92903 15.9539 7.1355M15.6074 2.55856C14.1065 0.133973 10.1593 0.858312 8.65628 2.55856C8.0665 3.22628 6.83043 4.91967 7.4328 7.0364C7.50319 7.28376 7.60304 7.51441 7.72719 7.72719M15.6074 2.55856C16.1785 3.29024 17.0071 5.00372 16.2987 6.55765M15.9539 7.1355C16.0956 6.94695 16.2094 6.75356 16.2987 6.55765M10.3141 9.39412C12.005 9.66237 15.569 9.47062 16.2987 6.55765M10.3141 9.39412C9.81285 9.32174 9.31981 9.14768 8.88285 8.88285M20.1817 14.9725L20.5452 15.6356C20.9847 16.4372 21.1845 17.3672 20.7826 18.1851M20.1817 14.9725C19.394 13.5357 17.7838 12.6281 16.0225 12.6281H12.6281M20.1817 14.9725C20.5933 16.062 20.6284 17.7839 19.3697 19.3697M20.7826 18.1851C20.5151 18.7295 20.1515 19.2406 19.7105 19.7105M20.7826 18.1851C20.6768 18.6975 20.4214 19.3338 19.9741 19.9741M11.3034 22.8876C8.207 22.8099 5.14616 21.5139 3.37589 18.4843C2.79587 17.4917 2.9308 16.3039 3.48235 15.2979L3.66075 14.9725C4.44845 13.5357 6.05862 12.6281 7.81996 12.6281H9M11.3034 22.8876C13.9987 22.5308 15.9479 21.8736 17.3348 21.0701L17.6033 21.3386M11.3034 22.8876C13.5431 22.9438 15.8013 22.3624 17.6033 21.3386M11.3034 22.8876C14.3753 23.2544 16.5494 22.6821 18.0379 21.7732L17.6033 21.3386M8.88285 8.88285L7.72719 7.72719M8.88285 8.88285L12.6281 12.6281M1 1L7.72719 7.72719M12.6281 12.6281L19.3697 19.3697M19.7105 19.7105L19.3697 19.3697M19.7105 19.7105L19.9741 19.9741M19.9741 19.9741L23 23"

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

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Header — search is a root tab, no back button */}
      <div style={{ padding: '14px 24px', borderBottom: '2px solid var(--border-strong)', background: 'var(--surface)' }}>
        <div className="relay-page-header-row">
          <h1 className="relay-page-title">Search</h1>
        </div>
      </div>

      {/* Search bar */}
      <div style={{ padding: '10px 24px', borderBottom: '2px solid var(--border-strong)', background: 'var(--surface)' }}>
        <div style={{ position: 'relative' }}>
          <SearchIcon
            size={15}
            {...iconProps}
            style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }}
          />
          <input
            type="text"
            placeholder="Search by username..."
            value={query}
            onChange={handleSearch}
            autoFocus
            className="relay-input"
            style={{
              width: '100%',
              padding: '10px 14px 10px 36px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '15px',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column' }}>
        {/* New Group — always the first row above search results, only
            in the default (not-yet-typed) state, same as
            NewConversationSheet's own Mode 1 default view. Pinned at the
            top rather than joining the centered group below it, since
            it's a persistent action, not part of the "nothing here yet"
            messaging. */}
        {!loading && !searched && (
          <button
            onClick={() => setShowNewGroup(true)}
            className="relay-menu-row"
            style={{ padding: '14px 20px', margin: '0 -20px', width: 'calc(100% + 40px)', borderRadius: 0, borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-accent)', flexShrink: 0 }}>
              <Users size={18} {...iconProps} />
            </div>
            <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)' }}>New Group</p>
          </button>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)', fontSize: '14px' }}>
            Searching...
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: 'var(--error-light)',
            border: '1.5px solid var(--error)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 14px',
            fontSize: '13px',
            color: 'var(--error)',
          }}>
            {error}
          </div>
        )}

        {/* No results — fills and centers in whatever space is left,
            rather than sitting at a fixed distance below the search bar. */}
        {!loading && searched && results.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <NotionDoodle d={USER_SLASH_PATH} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', marginBottom: '6px', letterSpacing: '-0.01em' }}>No users found</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
              No one matches &quot;{query}&quot;. Try a different username.
            </p>
          </div>
        )}

        {/* Empty state — same centering, in the remaining space below
            the pinned New Group row. */}
        {!loading && !searched && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <NotionDoodle d={USERS_PATH} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', marginBottom: '6px', letterSpacing: '-0.01em' }}>Find people on Relay</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
              Search by username to find and message people.
            </p>
          </div>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '8px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {results.length} {results.length === 1 ? 'result' : 'results'}
            </p>
            {results.map(user => (
              <div
                key={user.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  margin: '0 -20px',
                  padding: '13px 20px 13px 17px',
                  borderLeft: '3px solid transparent',
                  borderBottom: '1px solid var(--border-light)',
                  transition: 'background 0.1s, border-color 0.1s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--surface-hover)'
                  e.currentTarget.style.borderLeftColor = 'var(--accent)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'none'
                  e.currentTarget.style.borderLeftColor = 'transparent'
                }}
              >
                <button
                  onClick={() => openProfile(user.username)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                >
                  <Avatar src={user.avatar_url} name={user.display_name} size={48} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.display_name}
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>@{user.username}</p>
                  </div>
                </button>
                <button
                  onClick={() => openMenu(user)}
                  aria-label="More options"
                  className="relay-plain-icon-btn"
                  style={{ flexShrink: 0 }}
                >
                  <MoreHorizontal size={18} {...iconProps} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomSheet isOpen={!!menuUser} onClose={closeMenu}>
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
              style={{ padding: '14px 20px', fontSize: '15px', color: 'var(--text)', borderRadius: 0 }}
              onClick={handleOpenOrRequest}
              disabled={checkingConv}
            >
              {checkingConv ? <span style={{ width: 17 }}>···</span> : menuConvId ? <MessageCircle size={17} {...iconProps} /> : <Send size={17} {...iconProps} />}
              {checkingConv ? 'Checking...' : menuConvId ? 'Open chat' : 'Send message request'}
            </button>
            <button className="relay-menu-row" style={{ padding: '14px 20px', fontSize: '15px', color: 'var(--text)', borderRadius: 0 }} onClick={handleViewProfile}>
              <User size={17} {...iconProps} /> View profile
            </button>
            <button className="relay-menu-row" style={{ padding: '14px 20px', fontSize: '15px', color: 'var(--text)', borderRadius: 0 }} onClick={handleShareProfile}>
              <Share2 size={17} {...iconProps} /> Share profile
            </button>
            <button className="relay-menu-row" style={{ padding: '14px 20px', fontSize: '15px', color: 'var(--error)', borderRadius: 0 }} onClick={handleBlockClick}>
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

      <NewConversationSheet
        isOpen={showNewGroup}
        onClose={() => setShowNewGroup(false)}
        initialMode="group"
      />
    </div>
  )
}
