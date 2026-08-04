import Skeleton from '@/components/shared/Skeleton'

// Fixed, deterministic mix of alternating own/other bubbles at varying
// widths/heights — not randomized, so this doesn't shift shape on every
// remount (e.g. React StrictMode's double-render in dev) and stays
// visually stable for the brief window it's actually on screen. Heights
// vary too (not just widths) so the row doesn't read as a flat, robotic
// stack of identical rectangles.
const BUBBLES = [
  { isOwn: false, width: '48%', height: '36px' },
  { isOwn: true, width: '35%', height: '36px' },
  { isOwn: false, width: '62%', height: '52px' },
  { isOwn: false, width: '40%', height: '36px' },
  { isOwn: true, width: '58%', height: '36px' },
  { isOwn: true, width: '44%', height: '36px' },
  { isOwn: false, width: '55%', height: '36px' },
  { isOwn: false, width: '38%', height: '36px' },
  { isOwn: true, width: '60%', height: '52px' },
  { isOwn: false, width: '68%', height: '52px' },
  { isOwn: true, width: '45%', height: '36px' },
  { isOwn: true, width: '65%', height: '36px' },
  { isOwn: false, width: '50%', height: '36px' },
  { isOwn: true, width: '42%', height: '36px' },
]

// Shown in chat/[id]/page.js during a true cold load, before messages
// arrive (a cache hit shows the cached messages instantly instead — this
// never flashes on a warm conversation reopen). Bordered like the real
// bubbles they stand in for (2px solid, same neo-brutalist treatment) —
// a borderless shimmer fill alone read as washed-out and disappeared
// into the tiled chat-background pattern instead of looking like actual
// message shapes. Fades older (higher up) rows down slightly so the
// most recent-looking row at the bottom stays the most prominent.
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
            opacity: 0.45 + (i / (BUBBLES.length - 1)) * 0.55,
          }}
        >
          <Skeleton
            width={bubble.width}
            height={bubble.height}
            borderRadius={bubble.isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px'}
            style={{
              maxWidth: '70%',
              border: '2px solid var(--border-strong)',
            }}
          />
        </div>
      ))}
    </div>
  )
}
