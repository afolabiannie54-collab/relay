// Base shimmer skeleton — a gradient sweep rather than the simple
// opacity-pulse .relay-skeleton class already used for small one-off
// placeholders (e.g. the conversation header while it loads). This one is
// for full skeleton SCREENS (ChatListSkeleton, MessagesSkeleton) where a
// moving highlight reads as "actively loading" more convincingly across a
// whole layout of shapes. The @keyframes lives once in globals.css
// (relay-shimmer) rather than being injected per instance.
//
// Uses --surface-hover/--surface-active (this app's actual two-step
// surface tokens) as the two gradient stops, not the --bg-secondary/
// --bg-tertiary names from a generic spec — this app's token system
// doesn't define those.
export default function Skeleton({ width = '100%', height = '16px', borderRadius = 'var(--radius-sm)', style }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, var(--surface-hover) 25%, var(--surface-active) 50%, var(--surface-hover) 75%)',
        backgroundSize: '200% 100%',
        animation: 'relay-shimmer 1.5s infinite',
        flexShrink: 0,
        ...style,
      }}
    />
  )
}
