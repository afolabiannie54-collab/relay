// The signpost the mascot holds, pulled out of the logo artwork as its own
// asset (see public/icons/signpost-light.svg / signpost-dark.svg) — cropped
// to the same shared viewBox as each other so it can't shift a pixel when
// the theme swaps, same rule as Logo.js. Reuses the .relay-logo-light/dark
// classes from globals.css: that CSS is generic image-pair theme-toggling,
// not actually logo-specific, so there's no need for a duplicate pair.
const ASPECT = '492.7 / 631.2'

export default function Signpost({ size = '80px' }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', height: size, aspectRatio: ASPECT }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="relay-logo-light" src="/icons/signpost-light.svg" alt="" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="relay-logo-dark" src="/icons/signpost-dark.svg" alt="" />
    </span>
  )
}
