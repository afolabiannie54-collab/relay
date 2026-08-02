'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Share2, UserX, Flag, Globe, Link as LinkIcon } from 'lucide-react'
import BottomSheet from '@/components/shared/BottomSheet'
import ConfirmSheet from '@/components/shared/ConfirmSheet'
import Avatar from '@/components/shared/Avatar'
import CopyUsernameButton from '@/components/profile/CopyUsernameButton'
import OnlineStatus from '@/components/profile/OnlineStatus'
import MessageButton from '@/components/profile/MessageButton'
import { getProfileByUsername } from '@/actions/users'
import { blockUser } from '@/actions/blocks'
import { createClient } from '@/lib/supabase/client'
import { useProfileSheet } from '@/lib/profile-sheet-context'
import { cache } from '@/lib/cache'

const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

function socialHref(platform, value) {
  if (!value) return null
  const trimmed = value.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const handle = trimmed.replace(/^@/, '')
  if (platform === 'twitter') return `https://twitter.com/${handle}`
  if (platform === 'instagram') return `https://instagram.com/${handle}`
  if (platform === 'linkedin') return `https://${trimmed.replace(/^https?:\/\//i, '')}`
  return `https://${trimmed}`
}

// Single shared overlay for every "view this person's profile" entry
// point in the app (search, a conversation's header/settings, message
// requests, notifications, the sender's own profile preview in
// Settings). Replaces the old routed /u/[username] page — that URL
// still works for a cold/shared link, it just redirects into /chat and
// hands the username to this same sheet (see profile-sheet-context.js).
export default function ProfileSheet() {
  const router = useRouter()
  const { username, closeProfile } = useProfileSheet()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // The app shell (main)/layout.js already primes this same cache key
  // with the signed-in user's own profile — reading it here means
  // isOwnProfile is correct from the very first render instead of
  // flashing the "message" action before switching to "edit profile".
  const [currentUserId, setCurrentUserId] = useState(() => cache.peek('profile')?.id || null)
  const [showMenu, setShowMenu] = useState(false)
  const [confirmBlock, setConfirmBlock] = useState(false)

  useEffect(() => {
    if (currentUserId) return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setCurrentUserId(data.user.id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!username) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setProfile(null)
    getProfileByUsername(username).then(result => {
      if (cancelled) return
      if (result.error) setError(result.error)
      else setProfile(result.data)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [username])

  useEffect(() => {
    if (!username) {
      setShowMenu(false)
      setConfirmBlock(false)
    }
  }, [username])

  const isOwnProfile = profile && currentUserId === profile.id

  const handleShare = async () => {
    const url = `${window.location.origin}/u/${profile.username}`
    if (navigator.share) {
      try { await navigator.share({ url }); setShowMenu(false); return } catch { /* fall through to copy */ }
    }
    try { await navigator.clipboard.writeText(url) } catch {}
    setShowMenu(false)
  }

  const handleBlock = async () => {
    await blockUser(profile.id)
    window.dispatchEvent(new Event('relay:conversations-changed'))
    closeProfile()
  }

  const socialLinks = profile ? [
    { key: 'website', Icon: Globe, href: socialHref('website', profile.website) },
    { key: 'twitter', Icon: LinkIcon, href: socialHref('twitter', profile.twitter) },
    { key: 'instagram', Icon: LinkIcon, href: socialHref('instagram', profile.instagram) },
    { key: 'linkedin', Icon: LinkIcon, href: socialHref('linkedin', profile.linkedin) },
  ].filter(link => link.href) : []

  return (
    <>
      <BottomSheet isOpen={!!username} onClose={closeProfile}>
        <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
          {loading || !profile ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
                {error || 'Loading...'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '8px 24px 28px', position: 'relative' }}>
              {!isOwnProfile && (
                <div style={{ position: 'absolute', top: '0', right: '20px' }}>
                  <button
                    onClick={() => setShowMenu(true)}
                    aria-label="More options"
                    className="relay-plain-icon-btn"
                  >
                    <MoreHorizontal size={20} {...iconProps} />
                  </button>
                </div>
              )}

              <Avatar src={profile.avatar_url} name={profile.display_name} size={88} />
              <h1 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text)', marginTop: '14px', marginBottom: '4px', letterSpacing: '-0.01em' }}>
                {profile.display_name}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>@{profile.username}</p>
                <CopyUsernameButton username={profile.username} />
              </div>

              <OnlineStatus
                userId={profile.id}
                lastSeen={profile.last_seen}
                showLastSeen={profile.show_last_seen}
                showOnlineStatus={profile.show_online_status}
              />

              {isOwnProfile && (
                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  This is how others see you
                </p>
              )}

              {profile.bio && (
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', marginTop: '16px', whiteSpace: 'pre-wrap' }}>
                  {profile.bio}
                </p>
              )}

              {socialLinks.length > 0 && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  {socialLinks.map(({ key, Icon, href }) => (
                    <a
                      key={key}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relay-plain-icon-btn"
                      style={{ width: '36px', height: '36px', border: '2px solid var(--border-strong)', color: 'var(--text-secondary)' }}
                    >
                      <Icon size={15} {...iconProps} />
                    </a>
                  ))}
                </div>
              )}

              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '20px' }}>
                Member since {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>

              <div style={{ marginTop: '20px', width: '100%', display: 'flex', justifyContent: 'center' }}>
                {isOwnProfile ? (
                  <button
                    onClick={() => { closeProfile(); router.push('/settings/profile') }}
                    className="relay-btn relay-btn--filled"
                    style={{ padding: '10px 20px' }}
                  >
                    Edit profile
                  </button>
                ) : (
                  <MessageButton receiverId={profile.id} displayName={profile.display_name} />
                )}
              </div>
            </div>
          )}
        </div>
      </BottomSheet>

      {profile && (
        <BottomSheet isOpen={showMenu} onClose={() => setShowMenu(false)}>
          <div style={{ padding: '8px 0', fontFamily: "'Inter', -apple-system, sans-serif" }}>
            <button className="relay-menu-row" style={{ padding: '14px 20px', fontSize: '15px', color: 'var(--text)', borderRadius: 0 }} onClick={handleShare}>
              <Share2 size={17} {...iconProps} /> Share profile
            </button>
            <button
              className="relay-menu-row"
              style={{ padding: '14px 20px', fontSize: '15px', color: 'var(--error)', borderRadius: 0 }}
              onClick={() => { setShowMenu(false); setConfirmBlock(true) }}
            >
              <UserX size={17} {...iconProps} /> Block user
            </button>
            <button
              disabled
              title="Coming soon"
              className="relay-menu-row"
              style={{ padding: '14px 20px', fontSize: '15px', color: 'var(--text-tertiary)', cursor: 'not-allowed', borderRadius: 0 }}
            >
              <Flag size={17} {...iconProps} /> Report (coming soon)
            </button>
          </div>
        </BottomSheet>
      )}

      <ConfirmSheet
        isOpen={confirmBlock}
        onClose={() => setConfirmBlock(false)}
        title={`Block ${profile?.display_name}?`}
        message="They won't be able to message you, and any existing conversation will be hidden."
        confirmLabel="Block"
        confirmStyle="danger"
        onConfirm={handleBlock}
      />
    </>
  )
}
