// Generates iOS PWA launch images (apple-touch-startup-image).
//
// iOS only uses an image whose media query matches the device exactly —
// width, height, pixel ratio AND orientation — so every device class needs
// its own file per orientation. Without a match it shows a blank white
// screen on launch, which on a dark-mode device is the exact flash the
// splash exists to prevent; that's why both themes are generated too.
const fs = require('fs')
const path = require('path')
const { createRequire } = require('module')

const ROOT = process.argv[2]
// This script lives outside the project, so a bare require('sharp') would
// resolve against the scratchpad and miss. Resolve from the project root.
const sharp = createRequire(path.join(ROOT, 'package.json'))('sharp')
const OUT = path.join(ROOT, 'public/splash')
// ICON no longer used — the logo SVGs in THEMES replaced it (see note there).

// CSS px + device pixel ratio. Grouped by identical dimensions — devices
// sharing a size share one image.
const DEVICES = [
  { w: 440, h: 956, r: 3, name: 'iphone-16-pro-max' },
  { w: 430, h: 932, r: 3, name: 'iphone-15-pro-max' },
  { w: 428, h: 926, r: 3, name: 'iphone-13-pro-max' },
  { w: 402, h: 874, r: 3, name: 'iphone-16-pro' },
  { w: 393, h: 852, r: 3, name: 'iphone-15-pro' },
  { w: 390, h: 844, r: 3, name: 'iphone-13' },
  { w: 375, h: 812, r: 3, name: 'iphone-x' },
  { w: 414, h: 896, r: 3, name: 'iphone-11-pro-max' },
  { w: 414, h: 896, r: 2, name: 'iphone-11' },
  { w: 414, h: 736, r: 3, name: 'iphone-8-plus' },
  { w: 375, h: 667, r: 2, name: 'iphone-8' },
  { w: 320, h: 568, r: 2, name: 'iphone-se' },
  { w: 1024, h: 1366, r: 2, name: 'ipad-pro-12' },
  { w: 834, h: 1194, r: 2, name: 'ipad-pro-11' },
  { w: 820, h: 1180, r: 2, name: 'ipad-air-10-9' },
  { w: 834, h: 1112, r: 2, name: 'ipad-pro-10-5' },
  { w: 810, h: 1080, r: 2, name: 'ipad-10-2' },
  { w: 768, h: 1024, r: 2, name: 'ipad-9-7' },
]

// Backgrounds match --background in globals.css, not manifest's
// background_color (#FFFFFF) — that has no dark variant, and the splash
// should be the colour the app shell actually paints on launch.
//
// The mark is the logo SVG, NOT icon-1024.png. That icon is opaque with its
// own near-white background baked in, so on the white light-mode splash it
// was a white square on white — invisible apart from a few dark strokes.
// The logo ships in two variants precisely so each one has contrast against
// its own theme: logo-light.svg is the dark-stroked drawing meant to sit on
// light, logo-dark.svg the light-stroked one for dark.
const THEMES = {
  light: { bg: '#ffffff', logo: 'public/icons/logo-light.svg' },
  dark: { bg: '#131312', logo: 'public/icons/logo-dark.svg' },
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })

  const manifest = []
  for (const d of DEVICES) {
    for (const orient of ['portrait', 'landscape']) {
      const pxW = Math.round((orient === 'portrait' ? d.w : d.h) * d.r)
      const pxH = Math.round((orient === 'portrait' ? d.h : d.w) * d.r)

      for (const [theme, { bg, logo }] of Object.entries(THEMES)) {
        // Sized off the short edge so it stays proportionate in landscape
        // too. Height drives it because the mark is a tall figure; width
        // follows from the artwork's own aspect.
        const markH = Math.round(Math.min(pxW, pxH) * 0.30)

        // density scales SVG rasterisation — without raising it, sharp
        // renders at the file's nominal size first and the result is soft
        // when that's smaller than the target.
        const rounded = await sharp(path.join(ROOT, logo), { density: 400 })
          .resize({ height: markH, fit: 'inside' })
          .png()
          .toBuffer()

        const file = `${d.name}-${orient}-${theme}.png`
        await sharp({
          create: { width: pxW, height: pxH, channels: 4, background: bg },
        })
          .composite([{ input: rounded, gravity: 'center' }])
          .png({ compressionLevel: 9, palette: true })
          .toFile(path.join(OUT, file))

        // The image's pixels swap with orientation, but device-width and
        // device-height do NOT — on iOS they describe the physical screen,
        // which doesn't rotate. Only `orientation` distinguishes the two
        // queries. Emitting swapped dimensions here produces landscape
        // entries that can never match any device.
        manifest.push({ file, theme, orient, w: d.w, h: d.h, r: d.r })
      }
    }
  }

  fs.writeFileSync(path.join(OUT, '_manifest.json'), JSON.stringify(manifest, null, 2))

  // The light set carries NO prefers-color-scheme so it always matches —
  // support for that feature inside apple-touch-startup-image queries is
  // unreliable on iOS, and with every entry gated on it a device that
  // can't evaluate it matches nothing and shows no splash at all. Dark
  // entries come after, because WebKit takes the last matching link, so
  // where the feature does work dark wins and where it doesn't everyone
  // still gets a real splash instead of none.
  const mq = (e) => {
    const dims = `(device-width: ${e.w}px) and (device-height: ${e.h}px) and (-webkit-device-pixel-ratio: ${e.r}) and (orientation: ${e.orient})`
    return e.theme === 'dark' ? `(prefers-color-scheme: dark) and ${dims}` : dims
  }
  const ordered = [
    ...manifest.filter(e => e.theme === 'light'),
    ...manifest.filter(e => e.theme === 'dark'),
  ]
  const body = ordered
    .map(e => `  { url: '/splash/${e.file}', media: '${mq(e)}' },`)
    .join('\n')

  fs.writeFileSync(
    path.join(ROOT, 'lib/splashScreens.js'),
    `// GENERATED by scripts/gen-splash.js — do not edit by hand.
//
// iOS shows a launch image only when a declared one matches the device
// exactly, and a blank white screen otherwise — the bright flash on a
// dark-mode phone that a splash screen exists to prevent.
//
// The light entries carry no prefers-color-scheme condition and so always
// match. Support for that feature in these particular queries is unreliable
// on iOS, and gating every entry on it means a device that can't evaluate it
// matches nothing at all. Dark entries follow, since WebKit uses the last
// matching link: where the feature works dark wins, and where it doesn't
// there's still a real splash rather than none.
//
// device-width/device-height are the physical screen and do not rotate —
// both orientations share the same values and differ only by (orientation),
// while the image's own pixels swap.
export const APPLE_SPLASH_SCREENS = [
${body}
]
`
  )

  const bytes = manifest.reduce((n, m) => n + fs.statSync(path.join(OUT, m.file)).size, 0)
  console.log(`generated ${manifest.length} images, ${(bytes / 1024).toFixed(0)} KB total`)
  console.log(`wrote lib/splashScreens.js (${ordered.length} entries)`)
}

main().catch(e => { console.error(e); process.exit(1) })
