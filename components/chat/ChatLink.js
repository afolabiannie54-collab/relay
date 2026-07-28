'use client'

import Link from 'next/link'

// Plain Link wrapper for chat list rows. Previously wrapped navigation in
// the View Transitions API for a cross-fade, but that ran concurrently
// with the CSS transform slide in chat/layout.js — two uncoordinated
// animations of the same region produced visible jank and made the old
// page's captured screenshot look like a stale-content flash. The
// transform slide alone is the intended transition now.
//
// Uses replace instead of push so opening a conversation doesn't grow the
// browser's real history stack. Our own back button/swipe gesture always
// return to the list deterministically, but the phone's own system back
// gesture (or Safari's edge-swipe) bypasses that and just replays raw
// history — if every conversation open pushed a new entry, that gesture
// would retrace whatever sequence of screens you happened to click
// through to get here, not the app's actual list-then-conversation
// hierarchy. Keeping history flat means there's nothing for it to diverge
// on.
export default function ChatLink({ href, children, onClick, ...props }) {
  return (
    <Link href={href} prefetch={true} replace onClick={onClick} {...props}>
      {children}
    </Link>
  )
}
