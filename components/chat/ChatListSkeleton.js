import Skeleton from '@/components/shared/Skeleton'

// Five fake rows matching ChatList's own tile shape (48px avatar column,
// 14px/20px row padding, 12px gap) — shown only on a true cold load
// (ChatList.js falls back to whatever's cached instantly instead, so this
// never flashes on a warm session).
export default function ChatListSkeleton() {
  return (
    <div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-light)',
          }}
        >
          <Skeleton width="44px" height="44px" borderRadius="50%" />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Skeleton width="140px" height="14px" />
            <Skeleton width="200px" height="12px" />
          </div>
          <Skeleton width="40px" height="11px" style={{ flexShrink: 0 }} />
        </div>
      ))}
    </div>
  )
}
