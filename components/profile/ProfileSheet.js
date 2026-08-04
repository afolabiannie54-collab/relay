'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Share2, UserX, Flag, Globe, Link as LinkIcon } from 'lucide-react'
import BottomSheet from '@/components/shared/BottomSheet'
import ConfirmSheet from '@/components/shared/ConfirmSheet'
import Avatar from '@/components/shared/Avatar'
import Skeleton from '@/components/shared/Skeleton'
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
    const result = await blockUser(profile.id)
    if (result?.error) return result
    window.dispatchEvent(new Event('relay:conversations-changed'))
    closeProfile()
    return result
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
          {error ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>{error}</p>
            </div>
          ) : loading || !profile ? (
            <div style={{ padding: '18px 24px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', minHeight: '32px' }} />
              <Skeleton width="96px" height="96px" borderRadius="50%" style={{ marginTop: '16px' }} />
              <Skeleton width="140px" height="18px" style={{ marginTop: '16px' }} />
              <Skeleton width="90px" height="13px" style={{ marginTop: '8px' }} />
            </div>
          ) : (
            <div style={{ padding: '18px 24px 32px' }}>
              {/* Reserves the row's height whether or not the menu button
                  renders, so the identity block below always starts at
                  the same vertical position instead of the "..." button
                  eating into the top padding on someone else's profile. */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', minHeight: '32px' }}>
                {!isOwnProfile && (
                  <button
                    onClick={() => setShowMenu(true)}
                    aria-label="More options"
                    className="relay-plain-icon-btn"
                    style={{ marginRight: '-8px', marginTop: '-6px' }}
                  >
                    <MoreHorizontal size={20} {...iconProps} />
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <Avatar src={profile.avatar_url} name={profile.display_name} size={96} />
                <h1 style={{ fontSize: '21px', fontWeight: '800', color: 'var(--text)', marginTop: '16px', marginBottom: '4px', letterSpacing: '-0.01em' }}>
                  {profile.display_name}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '6px' }}>
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
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', marginTop: '18px', whiteSpace: 'pre-wrap' }}>
                    {profile.bio}
                  </p>
                )}

                {socialLinks.length > 0 && (
                  <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
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

                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '24px' }}>
                  Member since {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>

                {/* The one accent moment on this screen — same hard-shadow
                    CTA treatment as Send in the composer, since this is the
                    single primary action a profile sheet offers. */}
                <div style={{ marginTop: '28px', width: '100%', display: 'flex', justifyContent: 'center' }}>
                  {isOwnProfile ? (
                    <button
                      onClick={() => { closeProfile(); router.push('/settings/profile') }}
                      className="relay-btn relay-btn--filled"
                      style={{ padding: '11px 22px', boxShadow: 'var(--shadow-hard-accent)' }}
                    >
                      Edit profile
                    </button>
                  ) : (
                    <MessageButton receiverId={profile.id} displayName={profile.display_name} />
                  )}
                </div>
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
