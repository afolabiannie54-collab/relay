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
//
// That alone isn't enough, though: iOS scrolls the document to reveal a
// focused input the instant it's focused, before the keyboard has
// finished animating in and before the visualViewport resize event (which
// is what updates --app-height) has fired. The browser's own scroll wins
// that race, so the page shifts anyway even though our container would
// have fit correctly a moment later. Since the app shell handles all of
// its own scrolling internally (every scrollable region already has its
// own overflow:auto), the document itself never legitimately needs to
// scroll — so this disables document-level scrolling outright for as
// long as the app shell is mounted, and forces the scroll position back
// to the top on every visualViewport change as a second line of defense.
export function useAppHeight() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const previousHtmlOverflow = document.documentElement.style.overflow
    const previousBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'

    const resetScroll = () => window.scrollTo(0, 0)
    window.addEventListener('scroll', resetScroll)

    let vv = null
    let update = null
    if (window.visualViewport) {
      vv = window.visualViewport
      update = () => {
        document.documentElement.style.setProperty('--app-height', `${vv.height}px`)
        window.scrollTo(0, 0)
      }
      update()
      vv.addEventListener('resize', update)
      vv.addEventListener('scroll', update)
    }

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow
      document.body.style.overflow = previousBodyOverflow
      window.removeEventListener('scroll', resetScroll)
      if (vv && update) {
        vv.removeEventListener('resize', update)
        vv.removeEventListener('scroll', update)
      }
    }
  }, [])
}
