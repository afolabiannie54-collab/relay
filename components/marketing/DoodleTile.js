import NotionDoodle from '@/components/shared/illustrations/NotionDoodle'

// Shared bordered-tile treatment for the hand-drawn doodles — built for
// the footer's tile strip, reused wherever else a scattered illustration
// is wanted (the hero, eventually other sections) so there's one
// consistent "doodle sticker" language across the marketing pages instead
// of a different illustration style invented per section.
export default function DoodleTile({
  d,
  label,
  rot = 0,
  dy = 0,
  size = 'clamp(52px, 11vw, 68px)',
  artSize = '56%',
  style,
}) {
  return (
    <div
      className="marketing-doodle-tile"
      title={label}
      // display/alignment deliberately live in .marketing-doodle-tile, not
      // here: an inline `display` outranks every stylesheet rule, so the
      // media query that drops the last two tiles on mobile could never
      // beat it. Anything a breakpoint might need to override has to stay
      // out of this object.
      style={{
        '--tile-rot': `${rot}deg`,
        transform: `rotate(${rot}deg) translateY(${dy}px)`,
        width: size,
        height: size,
        flexShrink: 0,
        background: 'var(--footer-tile-bg)',
        border: '2.5px solid var(--border-strong)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-hard-sm)',
        ...style,
      }}
    >
      {/* Percentage rather than a pixel value, so the drawing tracks the
          tile's own size instead of staying fixed and crowding the edges
          as `size` clamps down on smaller screens. */}
      <NotionDoodle d={d} size={artSize} color="var(--text)" />
    </div>
  )
}
