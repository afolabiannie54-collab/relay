'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BottomSheet from '@/components/shared/BottomSheet'
import ConfirmSheet from '@/components/shared/ConfirmSheet'
import { blockUser } from '@/actions/blocks'

export default function ProfileMenu({ isOwnProfile, userId, username, displayName, backHref }) {
  const router = useRouter()
  const [showMenu, setShowMenu] = useState(false)
  const [confirmBlock, setConfirmBlock] = useState(false)

  const handleShare = async () => {
    const url = `${window.location.origin}/u/${username}`
    if (navigator.share) {
      try { await navigator.share({ url }); setShowMenu(false); return } catch { /* fall through to copy */ }
    }
    try { await navigator.clipboard.writeText(url) } catch {}
    setShowMenu(false)
  }

  const handleBlock = async () => {
    await blockUser(userId)
    // Same signal every other block handler in the app fires — without
    // it, ChatList wouldn't know to drop a now-hidden existing DM from
    // its list until some later, unrelated trigger refreshed it.
    window.dispatchEvent(new Event('relay:conversations-changed'))
    router.push(backHref)
  }

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
    <>
      <button
        onClick={() => setShowMenu(true)}
        aria-label="More options"
        style={{
          width: '44px',
          height: '44px',
          background: 'none',
          border: 'none',
          fontSize: '20px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ⋯
      </button>

      <BottomSheet isOpen={showMenu} onClose={() => setShowMenu(false)}>
        <div style={{ padding: '8px 0', fontFamily: "'Inter', -apple-system, sans-serif" }}>
          <button style={rowStyle} onClick={handleShare}>
            {isOwnProfile ? '🔗 Share my profile' : '🔗 Share profile'}
          </button>
          {!isOwnProfile && (
            <>
              <button style={{ ...rowStyle, color: '#EF4444' }} onClick={() => { setShowMenu(false); setConfirmBlock(true) }}>
                🚫 Block user
              </button>
              <button
                disabled
                title="Coming soon"
                style={{ ...rowStyle, color: '#D4D4D4', cursor: 'not-allowed' }}
              >
                🚩 Report (coming soon)
              </button>
            </>
          )}
        </div>
      </BottomSheet>

      <ConfirmSheet
        isOpen={confirmBlock}
        onClose={() => setConfirmBlock(false)}
        title={`Block ${displayName}?`}
        message="They won't be able to message you, and any existing conversation will be hidden."
        confirmLabel="Block"
        confirmStyle="danger"
        onConfirm={handleBlock}
      />
    </>
  )
}
