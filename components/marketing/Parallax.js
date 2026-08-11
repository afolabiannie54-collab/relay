'use client'

import { useEffect } from 'react'

// Drifts [data-parallax] elements as the page scrolls. The attribute's
// value is the speed: 0.1 moves the element a tenth of the scroll
// distance, so it falls behind the page and reads as sitting further back.
//
// Progress is measured from the nearest enclosing [data-parallax-root]'s
// viewport position, NOT from window.scrollY. globals.css sets
// overflow-x: hidden on html and body, and when overflow-x is hidden
// while overflow-y is visible the used value of overflow-y becomes auto —
// so with height: 100% on both, the document scrolls inside <body> and
// window.scrollY is pinned at 0. A rect is scroller-agnostic. (This is
// why the sibling ScrollReveal works regardless: IntersectionObserver
// doesn't care either.)
//
// Per-element roots, not one shared one: progress has to be relative to
// the section an element belongs to. Measured against a single root, a
// section further down the page would inherit that root's accumulated
// scroll distance and be flung far out of position.
//
// A root is read rather than the element itself because elements carry
// the parallax transform — measuring them would feed their own offset
// back into the next frame's input. An element may be its own root only
// when the effect doesn't move its box (a background-position shift, for
// instance), which is why closest() matching self is allowed.
//
// The offset is published as --parallax-y rather than written straight to
// element.style.transform, because every target already carries its own
// rotate() in an inline transform. Assigning transform here would wipe
// that; instead each element composes the variable into its own transform
// and keeps its rotation.
export default function Parallax() {
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll('[data-parallax]'))
      .map(el => ({
        el,
        root: el.closest('[data-parallax-root]'),
        speed: parseFloat(el.dataset.parallax) || 0,
      }))
      // Silently skipping a target with no root would be an invisible
      // no-op that's awkward to debug later; there's nothing sensible to
      // measure against, so drop it here rather than guess.
      .filter(t => t.root && t.speed)
    if (!targets.length) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    // Below this width the decorations are display:none anyway (see
    // .hero-mascot), so there is nothing to move and no reason to pay for
    // scroll work on the devices least able to spare it.
    const wide = window.matchMedia('(min-width: 641px)')

    let raf = 0
    const update = () => {
      raf = 0
      const active = wide.matches && !reduce.matches
      if (!active) {
        targets.forEach(t => t.el.style.removeProperty('--parallax-y'))
        return
      }
      // All reads, then all writes. Interleaving them would force a
      // synchronous layout per element on every frame.
      const offsets = targets.map(t => -t.root.getBoundingClientRect().top * t.speed)
      targets.forEach((t, i) => {
        t.el.style.setProperty('--parallax-y', `${offsets[i].toFixed(1)}px`)
      })
    }

    // rAF-coalesced: scroll fires far more often than the screen redraws,
    // and only the last value before a paint is the one anyone sees.
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }

    update()
    // Capture phase, on document: scroll doesn't bubble, and per the note
    // above the scrolling element here is <body>, not the viewport — a
    // plain window listener would never fire. Capture catches it wherever
    // it originates, so this keeps working if the scroll container moves.
    document.addEventListener('scroll', onScroll, { passive: true, capture: true })
    window.addEventListener('resize', onScroll, { passive: true })
    // Re-evaluated on change rather than only at mount, so rotating a
    // tablet or toggling reduced-motion takes effect without a reload —
    // and so switching to narrow actively clears any offset left behind.
    reduce.addEventListener('change', update)
    wide.addEventListener('change', update)

    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('resize', onScroll)
      reduce.removeEventListener('change', update)
      wide.removeEventListener('change', update)
      if (raf) cancelAnimationFrame(raf)
      targets.forEach(t => t.el.style.removeProperty('--parallax-y'))
    }
  }, [])

  return null
}
