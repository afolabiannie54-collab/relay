'use client'

import Link from 'next/link'

// Plain Link wrapper for chat list rows. Previously wrapped navigation in
// the View Transitions API for a cross-fade, but that ran concurrently
// with the CSS transform slide in chat/layout.js — two uncoordinated
// animations of the same region produced visible jank and made the old
// page's captured screenshot look like a stale-content flash. The
// transform slide alone is the intended transition now.
//
// A plain push — normal Link/history behavior. The conversation's own
// back button and swipe gesture always navigate to a fixed destination
// regardless of what's in history, so this doesn't need to do anything
// special.
export default function ChatLink({ href, children, onClick, ...props }) {
  return (
    <Link href={href} prefetch={true} onClick={onClick} {...props}>
      {children}
    </Link>
  )
}
