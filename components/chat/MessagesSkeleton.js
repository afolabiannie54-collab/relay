import Skeleton from '@/components/shared/Skeleton'

// Fixed, deterministic mix of alternating own/other bubbles at varying
// widths — not randomized, so this doesn't shift shape on every remount
// (e.g. React StrictMode's double-render in dev) and stays visually
// stable for the brief window it's actually on screen.
const BUBBLES = [
  { isOwn: false, width: '55%' },
  { isOwn: false, width: '40%' },
  { isOwn: true, width: '60%' },
  { isOwn: false, width: '70%' },
  { isOwn: true, width: '45%' },
  { isOwn: true, width: '65%' },
  { isOwn: false, width: '50%' },
  { isOwn: true, width: '42%' },
]

// Shown in chat/[id]/page.js during a true cold load, before messages
// arrive (a cache hit shows the cached messages instantly instead — this
// never flashes on a warm conversation reopen).
export default function MessagesSkeleton() {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      gap: '10px',
      padding: '16px',
    }}>
      {BUBBLES.map((bubble, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            justifyContent: bubble.isOwn ? 'flex-end' : 'flex-start',
          }}
        >
          <Skeleton
            width={bubble.width}
            height="36px"
            borderRadius={bubble.isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px'}
            style={{ maxWidth: '70%' }}
          />
        </div>
      ))}
    </div>
  )
}
