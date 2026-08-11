'use client'

import { useEffect } from 'react'

// Reveals [data-reveal] elements as they scroll into view.
//
// The hidden state is applied by JS, not by the stylesheet alone: the CSS
// only hides things once `reveal-ready` is on <html>, which this adds on
// mount. Without that gate, anyone whose JS never runs — or whose browser
// lacks IntersectionObserver — would be left staring at a page of
// permanently invisible sections, which is a far worse failure than
// simply not animating.
//
// Nothing above the fold should carry data-reveal. This class lands after
// first paint, so an element already on screen would paint visible, snap
// hidden, then fade back in. Below the fold that's invisible; in the hero
// it would be an obvious flicker.
export default function ScrollReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('[data-reveal]'))
    if (!els.length || !('IntersectionObserver' in window)) return

    const root = document.documentElement
    root.classList.add('reveal-ready')

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-visible')
          // One-shot: re-hiding on scroll-up makes a page feel twitchy
          // when you're scrolling back to re-read something.
          io.unobserve(entry.target)
        }
      },
      // Fires slightly before the element reaches the bottom edge, so the
      // motion reads as the section arriving rather than as something
      // that was already sitting there catching up.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.1 }
    )

    els.forEach((el) => io.observe(el))
    return () => {
      io.disconnect()
      root.classList.remove('reveal-ready')
    }
  }, [])

  return null
}
