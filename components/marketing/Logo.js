// ─────────────────────────────────────────────────────────────
//  LOGO SIZES — change these to resize the logo.
//  The value is the HEIGHT of the drawing; width follows from
//  the artwork's own proportions. Any CSS length works, so
//  clamp() lets it scale with the viewport instead of staying
//  a fixed size that overwhelms a phone screen.
//    clamp(MIN, PREFERRED, MAX)
// ─────────────────────────────────────────────────────────────
export const LOGO_SIZES = {
  nav: 'clamp(36px, 5.5vw, 50px)',
  footer: 'clamp(132px, 20vw, 260px)',
}

// The source SVGs are a 2500x2500 canvas with the drawing occupying only
// 606,307 1443x1887 of it — roughly a quarter of the width on the left was
// empty. Scaling the box therefore scaled all that dead margin too, which
// is why a bigger logo just pushed everything further away instead of
// looking bigger. Their viewBox is now cropped to the artwork bounds, so
// the drawing fills its box edge to edge.
//
// Width comes from aspect-ratio rather than being computed in JS. That's
// what allows `size` to be a clamp() string: the browser resolves the
// height at layout time and derives the width from it, which arithmetic on
// a JS number could never do.
const ASPECT = '1443 / 1887'

// Uses the SVGs, not the PNGs. The mark is a detailed line drawing, so a
// raster version resampled down to nav size loses the thin strokes to
// antialiasing — it read as blurry no matter the source resolution.
//
// Both artworks ship and CSS hides the wrong one — see .relay-logo-* in
// globals.css for why this can't be a single filtered image.
//
// Critically, neither <img> may carry an inline `display`: inline styles
// outrank stylesheet rules, so setting display:block here would defeat the
// display:none that does the theme swap and BOTH logos would render, one
// stacked under the other. Display is owned entirely by the CSS.
//
// `flip` mirrors the mark horizontally. Applied to the wrapper rather than
// each <img> so the two theme variants can't end up facing opposite ways.
export default function Logo({ size = '56px', showWordmark = true, flip = false }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: `calc(${size} * 0.18)`,
    }}>
      <span style={{
        position: 'relative',
        height: size,
        aspectRatio: ASPECT,
        flexShrink: 0,
        transform: flip ? 'scaleX(-1)' : undefined,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="relay-logo-light" src="/icons/logo-light.svg" alt="" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="relay-logo-dark" src="/icons/logo-dark.svg" alt="" />
      </span>
      {showWordmark && (
        <span style={{
          fontSize: `calc(${size} * 0.5)`,
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
