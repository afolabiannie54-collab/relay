'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
]

// Only rendered visually below 720px (see .marketing-mobile-nav) — this
// is what Home/Privacy/Terms collapse into once the pill's tabs run out
// of room, since NavLinks itself just disappears at that breakpoint.
export default function MobileNav({ signedIn }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="marketing-mobile-nav" ref={rootRef}>
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="marketing-mobile-menu-btn"
      >
        {open ? <X size={20} strokeWidth={2.5} /> : <Menu size={20} strokeWidth={2.5} />}
      </button>

      {open && (
        <div className="marketing-mobile-menu-panel">
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`marketing-mobile-menu-link${pathname === href ? ' marketing-mobile-menu-link--active' : ''}`}
            >
              {label}
            </Link>
          ))}
          {!signedIn && (
            <Link href="/login" onClick={() => setOpen(false)} className="marketing-mobile-menu-link marketing-mobile-menu-link--login">
              Log in
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
