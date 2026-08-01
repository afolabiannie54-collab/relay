// First entry in the app's hand-drawn illustration set — thin single-weight
// line art with one accent-colored detail, in the spirit of Notion's empty
// states. Line color follows --text-tertiary so it recedes in both themes;
// the accent dot is the only spot of color, kept deliberately small.
export default function EmptyChatsIllustration({ size = 132 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g stroke="var(--text-tertiary)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        {/* seated figure */}
        <circle cx="92" cy="78" r="26" />
        <path d="M78 58 Q88 46 104 54" />
        <path d="M62 168 Q58 112 92 110 Q126 110 122 168 Q122 186 92 190 Q62 186 62 168 Z" />
        <path d="M114 118 Q148 108 158 82" />
        <circle cx="159" cy="78" r="4.5" fill="var(--text-tertiary)" />
        <path d="M68 176 Q92 200 116 176" />
        <path d="M74 184 Q92 202 110 184" />

        {/* speech bubble with typing dots */}
        <rect x="146" y="30" width="76" height="50" rx="16" fill="var(--surface)" />
        <path d="M168 80 L160 96 L184 80 Z" fill="var(--surface)" />
        <circle cx="167" cy="55" r="3.2" fill="var(--text-tertiary)" stroke="none" />
        <circle cx="184" cy="55" r="3.2" fill="var(--text-tertiary)" stroke="none" />
        <circle cx="201" cy="55" r="3.2" fill="var(--text-tertiary)" stroke="none" />
      </g>

      {/* accent sparkle */}
      <circle cx="215" cy="20" r="5" fill="var(--accent)" />
      <path d="M28 60 L28 72 M22 66 L34 66" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
