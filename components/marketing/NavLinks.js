'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
]

// The bar's only other elements — the CTA button, the badge pill on the
// hero, the doodle tiles — all carry a hard border and a hard-offset
// shadow. Plain text links were the one piece of chrome with neither,
// which is why the nav read as thin next to the rest of the page. The
// current page now gets that same solid-chip treatment instead of only
// reacting on hover, so there's an actual active state too.
export default function NavLinks() {
  const pathname = usePathname()

  return (
    <nav className="marketing-nav-links">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={`marketing-navtab${active ? ' marketing-navtab--active' : ''}`}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
