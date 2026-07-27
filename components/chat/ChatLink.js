'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

// Wraps a callback in the View Transitions API when the browser supports it,
// falling back to running it directly otherwise. Used for chat list <->
// conversation navigation so panel swaps get a smooth cross-fade on top of
// the CSS transform slide, without requiring it.
export function navigateWithTransition(callback) {
  if (typeof document !== 'undefined' && document.startViewTransition) {
    document.startViewTransition(callback)
  } else {
    callback()
  }
}

export default function ChatLink({ href, children, onClick, ...props }) {
  const router = useRouter()

  const handleClick = (e) => {
    onClick?.(e)

    if (typeof document !== 'undefined' && document.startViewTransition) {
      e.preventDefault()
      navigateWithTransition(() => router.push(href))
    }
    // else: let next/link's default client-side navigation happen as normal —
    // the CSS transform transition on the panels (set up in chat/layout.js)
    // still applies regardless of whether the View Transitions API ran.
  }

  return (
    <Link href={href} prefetch={true} onClick={handleClick} {...props}>
      {children}
    </Link>
  )
}
