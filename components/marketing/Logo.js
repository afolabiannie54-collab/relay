// Both artworks ship and CSS hides the wrong one — see .relay-logo-* in
// globals.css for why this can't be a single filtered image.
//
// Critically, neither <img> may carry an inline `display`: inline styles
// outrank stylesheet rules, so setting display:block here would defeat the
// display:none that does the theme swap and BOTH logos would render, one
// stacked under the other. Display is owned entirely by the CSS.
export default function Logo({ size = 44, showWordmark = true }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.24 }}>
      <span style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="relay-logo-light"
          src="/icons/logo-light.png"
          alt=""
          width={size}
          height={size}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="relay-logo-dark"
          src="/icons/logo-dark.png"
          alt=""
          width={size}
          height={size}
        />
      </span>
      {showWordmark && (
        <span style={{
          fontSize: size * 0.55,
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
