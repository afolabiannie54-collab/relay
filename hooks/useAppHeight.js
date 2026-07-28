'use client'

import { useEffect } from 'react'

// iOS Safari's on-screen keyboard shrinks the visual viewport but NOT the
// layout viewport that CSS dvh/svh/lvh units are computed from — a
// height: 100dvh container stays exactly the same size when the keyboard
// opens, even though far less of it is actually visible.
//
// The VisualViewport API tracks the keyboard correctly, so this mirrors
// its height into a CSS custom property. Every fixed-height container in
// the app shell reads --app-height instead of a literal 100dvh, so they
// shrink to match the visible area when the keyboard is open.
//
// Deliberately minimal: an earlier version of this hook also forced
// document-level scroll to stay locked at (0, 0) while the app shell was
// mounted, to fight iOS's own scroll-into-view behavior on focus. That
// turned out to be worse than the problem it was solving — fighting the
// browser's own scroll handling broke the layout outright in some cases.
// This just tracks the real viewport size; it doesn't try to control
// scrolling at all.
export function useAppHeight() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return

    const vv = window.visualViewport
    const update = () => {
      document.documentElement.style.setProperty('--app-height', `${vv.height}px`)
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
}
