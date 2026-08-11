// Touch devices synthesize mouse events: onMouseEnter fires on tap, and
// onMouseLeave only fires once something *else* is tapped — so a hover
// style applied in JS stays stuck on whatever was last touched. That's the
// "desktop hover states show up when I tap" behaviour.
//
// The CSS half of this is handled by @media (hover: hover) in globals.css.
// This exists for the handlers that write inline styles instead, which a
// stylesheet rule can't override anyway (inline always wins), so they have
// to ask the question themselves.
//
// Only gate the *styling* in a handler. Side effects that happen to be
// wired to the same event — prefetching, for instance — should still run
// on touch, where they're just as useful.
export function canHover() {
  return typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches
}
