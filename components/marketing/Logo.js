// Both artworks ship and CSS hides the wrong one — see .relay-logo-* in
// globals.css for why this can't be a single filtered image. `size` drives
// the mark; the wordmark scales with it so the lockup stays proportional
// wherever it's used.
export default function Logo({ size = 36, showWordmark = true }) {
  // alt is written out on each <img> rather than folded into this spread —
  // the a11y lint rule can only see it statically, and a decorative mark
  // beside a text wordmark should be empty-alt, not undefined.
  const common = {
    width: size,
    height: size,
    style: { display: 'block', flexShrink: 0 },
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.28 }}>
      <span style={{ display: 'block', width: size, height: size, flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="relay-logo-light" src="/icons/logo-light.png" alt="" {...common} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="relay-logo-dark" src="/icons/logo-dark.png" alt="" {...common} />
      </span>
      {showWordmark && (
        <span style={{
          fontSize: size * 0.62,
          fontWeight: '900',
          letterSpacing: '-0.045em',
          color: 'var(--text)',
          lineHeight: 1,
        }}>
          Relay
        </span>
      )}
    </span>
  )
}
