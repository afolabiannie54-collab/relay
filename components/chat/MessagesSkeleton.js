import Skeleton from '@/components/shared/Skeleton'

// Fixed, deterministic mix of alternating own/other bubbles at varying
// widths — not randomized, so this doesn't shift shape on every remount
// (e.g. React StrictMode's double-render in dev) and stays visually
// stable for the brief window it's actually on screen. Enough rows here
// to fill a tall phone screen from near the top down to the composer —
// a shorter list left a large empty gap above since flex-end packs
// bubbles up from the bottom, which read as the skeleton "hugging" the
// composer instead of standing in for a full conversation.
const BUBBLES = [
  { isOwn: false, width: '48%' },
  { isOwn: true, width: '35%' },
  { isOwn: false, width: '62%' },
  { isOwn: false, width: '40%' },
  { isOwn: true, width: '58%' },
  { isOwn: true, width: '44%' },
  { isOwn: false, width: '55%' },
  { isOwn: false, width: '38%' },
  { isOwn: true, width: '60%' },
  { isOwn: false, width: '68%' },
  { isOwn: true, width: '45%' },
  { isOwn: true, width: '65%' },
  { isOwn: false, width: '50%' },
  { isOwn: true, width: '42%' },
  { isOwn: false, width: '58%' },
  { isOwn: true, width: '48%' },
  { isOwn: false, width: '36%' },
  { isOwn: true, width: '62%' },
  { isOwn: false, width: '52%' },
  { isOwn: true, width: '40%' },
]

// Shown in chat/[id]/page.js during a true cold load, before messages
// arrive (a cache hit shows the cached messages instantly instead — this
// never flashes on a warm conversation reopen).
//
// justifyContent is flex-start (top-anchored, natural stacking), not
// flex-end — the real messages-scroll-area container lays bubbles out
// the same way (flex-start, growing downward, then auto-scrolled to the
// bottom), so anchoring the skeleton there instead of packing it up from
// the bottom is what actually matches where real content appears, rather
// than just adding more bubbles to disguise a bottom anchor.
export default function MessagesSkeleton() {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      gap: '10px',
      padding: '16px',
      overflow: 'hidden',
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
