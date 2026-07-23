import { getProfileByUsername } from '@/actions/users'
import { createClient } from '@/lib/supabase/server'
import Avatar from '@/components/shared/Avatar'
import Link from 'next/link'
import MessageButton from '@/components/profile/MessageButton'

export default async function ProfilePage({ params }) {
  const { username } = await params
  const result = await getProfileByUsername(username)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (result.error) {
    return (
      <div style={{
        minHeight: '100vh',
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
          <Link href="/chat" style={{
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

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return null
    const date = new Date(lastSeen)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F5F5F5',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <div style={{
        background: '#fff',
        borderBottom: '1.5px solid #0a0a0a',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <Link href="/chat" style={{
          textDecoration: 'none',
          color: '#0a0a0a',
          fontSize: '14px',
          fontWeight: '600',
        }}>
          ← Back
        </Link>
        <span style={{ fontSize: '16px', fontWeight: '700' }}>Profile</span>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{
          background: '#fff',
          border: '1.5px solid #0a0a0a',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '4px 4px 0 #0a0a0a',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '20px',
            marginBottom: '24px',
          }}>
            <Avatar src={profile.avatar_url} name={profile.display_name} size={80} />
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0a0a0a', marginBottom: '2px' }}>
                {profile.display_name}
              </h1>
              <p style={{ fontSize: '14px', color: '#A3A3A3', marginBottom: '8px' }}>
                @{profile.username}
              </p>
              {profile.last_seen && (
                <p style={{ fontSize: '12px', color: '#A3A3A3' }}>
                  Last seen {formatLastSeen(profile.last_seen)}
                </p>
              )}
            </div>
          </div>

          {profile.bio && (
            <div style={{
              padding: '16px',
              background: '#F5F5F5',
              borderRadius: '8px',
              marginBottom: '24px',
              fontSize: '14px',
              color: '#525252',
              lineHeight: '1.6',
            }}>
              {profile.bio}
            </div>
          )}

          <p style={{ fontSize: '12px', color: '#A3A3A3', marginBottom: '24px' }}>
            Member since {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
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
