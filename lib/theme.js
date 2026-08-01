const STORAGE_KEY = 'relay-theme'

// 'system' isn't written to the DOM at all — its absence is what lets the
// prefers-color-scheme media query in globals.css keep working. Only
// 'light'/'dark' ever get set as data-theme, to explicitly override it.
export function getStoredTheme() {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(STORAGE_KEY, theme)
  } else {
    document.documentElement.removeAttribute('data-theme')
    window.localStorage.removeItem(STORAGE_KEY)
  }
}

// Inlined into a blocking <script> in app/layout.js's <head> so the
// explicit choice applies before first paint — without this, a user who
// forced light mode while their OS is dark would see one dark frame
// flash before React hydrates and reapplies it.
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`
