'use client'

import { useEffect } from 'react'

// iOS Safari's on-screen keyboard shrinks the visual viewport but NOT the
// layout viewport that CSS dvh/svh/lvh units are computed from — a
// height: 100dvh container stays exactly the same size when the keyboard
// opens, even though far less of it is actually visible. To compensate,
// the browser scrolls the whole document to keep the focused input above
// the keyboard, dragging everything above it (a sticky header, in our
// case) along with it.
//
// The VisualViewport API tracks the keyboard correctly, so this mirrors
// its height into a CSS custom property. Every fixed-height container in
// the app shell reads --app-height instead of a literal 100dvh, so they
// actually shrink to match the visible area — the flex layout then keeps
// the header and input bar in place and only the scrollable message list
// resizes, instead of the whole page needing to scroll.
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
