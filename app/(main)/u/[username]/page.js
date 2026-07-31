import { getProfileByUsername } from '@/actions/users'
import { createClient } from '@/lib/supabase/server'
import Avatar from '@/components/shared/Avatar'
import Link from 'next/link'
import MessageButton from '@/components/profile/MessageButton'
import CopyUsernameButton from '@/components/profile/CopyUsernameButton'
import ProfileMenu from '@/components/profile/ProfileMenu'
import OnlineStatus from '@/components/profile/OnlineStatus'

// Without this, a viewer could see a stale show_online_status/
// show_last_seen value if the underlying fetch got cached — e.g.
// visiting the same profile shortly after its owner toggled a privacy
// setting. Forces this route to always render with fresh data.
export const revalidate = 0

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

export default async function ProfilePage({ params, searchParams }) {
  const { username } = await params
  const sp = await searchParams
  const result = await getProfileByUsername(username)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fixed parent hierarchy: this page has no single correct parent (it's
  // reachable from search, a conversation's header, a conversation's
  // settings, or a notification), so the caller tells us where "back"
  // should go via ?from=. Anything unrecognized (including no param at
  // all, e.g. opened from a notification) falls back to /chat.
  let backHref = '/chat'
  if (sp?.from === 'search') {
    backHref = '/search'
  } else if (sp?.from === 'conversation' && sp?.convId) {
    backHref = `/chat/${sp.convId}`
  } else if (sp?.from === 'conversation-settings' && sp?.convId) {
    backHref = `/chat/${sp.convId}/settings`
  } else if (sp?.from === 'settings') {
    backHref = '/settings/profile'
  }

  if (result.error) {
    return (
      <div style={{
        minHeight: '100dvh',
        background: '#F5F5F5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}>
        <div style={{
          background: '#fff',
          border: '1.5px solid #0a0a0a',
          borderRadius: '12px',
          padding: '40px',
          boxShadow: '4px 4px 0 #0a0a0a',
          textAlign: 'center',
          maxWidth: '400px',
          width: '100%',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px' }}>User not found</h1>
          <p style={{ fontSize: '14px', color: '#525252', marginBottom: '24px' }}>
            @{username} does not exist or may have been deleted.
          </p>
          <Link href={backHref} style={{
            display: 'inline-block',
            padding: '10px 20px',
            background: '#0a0a0a',
            color: '#fff',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: '3px 3px 0 #FFB800',
          }}>
            Go to chat
          </Link>
        </div>
      </div>
    )
  }

  const profile = result.data
  const isOwnProfile = user?.id === profile.id

  const socialLinks = [
    { key: 'website', icon: '🌐', href: socialHref('website', profile.website) },
    { key: 'twitter', icon: '𝕏', href: socialHref('twitter', profile.twitter) },
    { key: 'instagram', icon: '📸', href: socialHref('instagram', profile.instagram) },
    { key: 'linkedin', icon: '💼', href: socialHref('linkedin', profile.linkedin) },
  ].filter(link => link.href)

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#F5F5F5',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <div style={{
        background: '#fff',
        borderBottom: '1.5px solid #0a0a0a',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <Link href={backHref} style={{
          textDecoration: 'none',
          color: '#0a0a0a',
          fontSize: '18px',
          width: '44px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
        }}>
          ←
        </Link>
        <span style={{ fontSize: '16px', fontWeight: '700' }}>Profile</span>
        {isOwnProfile ? (
          <ProfileMenu isOwnProfile username={profile.username} displayName={profile.display_name} backHref={backHref} />
        ) : (
          <ProfileMenu isOwnProfile={false} userId={profile.id} username={profile.username} displayName={profile.display_name} backHref={backHref} />
        )}
      </div>

      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{
          background: '#fff',
          border: '1.5px solid #0a0a0a',
          borderRadius: '16px',
          padding: '32px 24px',
          boxShadow: '4px 4px 0 #0a0a0a',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}>
          <Avatar src={profile.avatar_url} name={profile.display_name} size={96} />
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0a0a0a', marginTop: '16px', marginBottom: '4px' }}>
            {profile.display_name}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
            <p style={{ fontSize: '14px', color: '#A3A3A3' }}>
              @{profile.username}
            </p>
            <CopyUsernameButton username={profile.username} />
          </div>

          <OnlineStatus userId={profile.id} lastSeen={profile.last_seen} showLastSeen={profile.show_last_seen} showOnlineStatus={profile.show_online_status} />

          {isOwnProfile && (
            <p style={{ fontSize: '11px', color: '#A3A3A3', marginTop: '4px' }}>
              This is how others see you
            </p>
          )}

          {profile.bio && (
            <p style={{
              fontSize: '14px',
              color: '#525252',
              lineHeight: '1.6',
              marginTop: '16px',
              whiteSpace: 'pre-wrap',
            }}>
              {profile.bio}
            </p>
          )}

          {socialLinks.length > 0 && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              {socialLinks.map(link => (
                <a
                  key={link.key}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#F5F5F5',
                    border: '1.5px solid #0a0a0a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '15px',
                    textDecoration: 'none',
                  }}
                >
                  {link.icon}
                </a>
              ))}
            </div>
          )}

          <p style={{ fontSize: '12px', color: '#A3A3A3', marginTop: '20px' }}>
            Member since {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>

          <div style={{ marginTop: '20px' }}>
            {isOwnProfile ? (
              <Link href="/settings/profile" style={{
                padding: '10px 20px',
                background: '#0a0a0a',
                color: '#fff',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: '600',
                boxShadow: '3px 3px 0 #FFB800',
              }}>
                Edit profile
              </Link>
            ) : (
              <MessageButton receiverId={profile.id} displayName={profile.display_name} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
