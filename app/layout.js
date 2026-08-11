import { Inter } from 'next/font/google'
import { themeInitScript } from '@/lib/theme'
import { APPLE_SPLASH_SCREENS } from '@/lib/splashScreens'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  display: 'swap',
})

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://relaymsg.vercel.app'

export const metadata = {
  // Required for openGraph/twitter image and url resolution — without it
  // Next warns at build time and emits relative social URLs, which most
  // crawlers won't follow.
  metadataBase: new URL(SITE_URL),
  title: 'Relay — Your people are one search away',
  description: 'Relay is a clean, fast messaging app. Find your people.',
  applicationName: 'Relay',
  manifest: '/manifest.json',
  // Declared here rather than as hand-written <link> tags so Next emits
  // them once, in the right order, without the duplicate apple-touch-icon
  // that was previously hardcoded in <head> alongside the metadata.
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: ['/icons/favicon-32.png'],
    // iOS ignores the manifest for home-screen icons and reads these
    // instead, which is why the iPad sizes are listed separately rather
    // than left to the manifest to cover.
    apple: [
      { url: '/icons/icon-180-ios.png', sizes: '180x180', type: 'image/png' },
      { url: '/icons/icon-167-ipad.png', sizes: '167x167', type: 'image/png' },
      { url: '/icons/icon-152-ipad.png', sizes: '152x152', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Relay',
    // iOS is the only platform that needs these: installed to the home
    // screen it shows a launch image while the app boots, and with none
    // declared it shows a blank white screen — jarring on a dark-mode
    // device. Android/desktop derive their splash from the manifest's
    // icon and background_color instead, so nothing is needed there.
    startupImage: APPLE_SPLASH_SCREENS,
  },
  openGraph: {
    title: 'Relay',
    description: 'Your people are one search away.',
    type: 'website',
    url: SITE_URL,
    siteName: 'Relay',
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'Relay' }],
  },
  twitter: {
    card: 'summary',
    title: 'Relay',
    description: 'Your people are one search away.',
    images: ['/icons/icon-512.png'],
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  // Matched to --surface in globals.css (#ffffff light, #1D1D1B dark) so
  // the status bar reads as part of the app header rather than a band
  // sitting on top of it. A single flat dark value would put a black bar
  // directly above a white header in light mode.
  // Keep these in step with --surface: the dark value sat at #161615 after
  // that token was lifted to #1D1D1B, which put a subtly different dark
  // immediately above the header — the exact seam this is meant to avoid.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#1D1D1B' },
  ],
}

// suppressHydrationWarning below is scoped to just the <html> element (not
// deep — it won't hide mismatches in children) — needed because
// themeInitScript intentionally mutates this tag's data-theme attribute
// before React hydrates, based on localStorage the server has no way to
// know. Without it, React flags that deliberate mutation as a mismatch.
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
