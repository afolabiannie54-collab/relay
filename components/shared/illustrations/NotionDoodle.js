// Renders one of the hand-drawn single-path icons from the downloaded
// Notion-Resources-Freebie pack (Notion-Icons/Regular/svg) at empty-state
// scale — the pack's own SVGs hardcode `stroke="black"`, so this swaps
// that for a themeable color instead of embedding them as raw <img>s.
// Native rounded linecap (not our square/miter UI-icon convention)
// preserved deliberately — this is a doodle/illustration, not a control.
export default function NotionDoodle({ d, viewBox = '0 0 24 24', size = 140, color = 'var(--text)' }) {
  return (
    <svg width={size} height={size} viewBox={viewBox} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d={d} stroke={color} strokeLinecap="round" />
    </svg>
  )
}
