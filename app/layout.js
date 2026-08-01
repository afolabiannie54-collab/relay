import { Inter } from 'next/font/google'
import { themeInitScript } from '@/lib/theme'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  display: 'swap',
})

export const metadata = {
  title: 'Relay — Your people are one search away.',
  description: 'Just relay the message.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Relay',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#FFB800',
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
        <link rel="apple-touch-icon" href="/icons/logo-light.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Relay" />
      </head>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
