// Notion-style illustration formula: a couple of simple geometric shapes,
// thick uniform-width strokes, one flat accent-color fill, a flat
// "grounding" shadow. A person was missing from the first pass of this —
// added back here as a plain circle head + simple rounded body, not the
// delicate multi-point figure from the original attempt.
export default function EmptyChatsIllustration({ size = 168 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 220 190"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* flat grounding shadow */}
      <ellipse cx="112" cy="178" rx="88" ry="8" fill="var(--border-light)" />

      {/* person — head, simple rounded body, one arm reaching toward the bubble */}
      <g stroke="var(--text)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M60 96 Q84 90 96 74" fill="none" />
        <path d="M18 150 Q14 86 42 86 Q70 86 66 150 Z" fill="var(--surface)" />
        <circle cx="42" cy="58" r="22" fill="var(--surface)" />
      </g>
      <circle cx="36" cy="56" r="2.4" fill="var(--text)" />
      <circle cx="48" cy="56" r="2.4" fill="var(--text)" />

      {/* chat bubble with typing dots */}
      <path
        d="M92 40 Q92 14 116 14 L176 14 Q200 14 200 40 L200 72 Q200 94 176 94 L134 94 L112 114 L116 94 Q92 92 92 72 Z"
        fill="var(--surface)"
        stroke="var(--text)"
        strokeWidth="8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="122" cy="54" r="7" fill="var(--text)" />
      <circle cx="148" cy="54" r="7" fill="var(--text)" />
      <circle cx="174" cy="54" r="7" fill="var(--text)" />

      {/* single accent-color pop */}
      <path
        d="M196 4 Q199 16 212 22 Q199 28 196 40 Q193 28 180 22 Q193 16 196 4 Z"
        fill="var(--accent)"
      />
    </svg>
  )
}
