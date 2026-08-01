'use client'

import { useEffect, useState } from 'react'
import { Monitor, Sun, Moon } from 'lucide-react'
import { getStoredTheme, applyTheme } from '@/lib/theme'

const OPTIONS = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

export default function ThemeToggle() {
  // Starts null rather than reading localStorage synchronously — this
  // component renders on the server, which has no window/localStorage, so
  // matching that on the client's first render avoids a hydration
  // mismatch. The real value lands a tick later via the effect below.
  const [theme, setTheme] = useState(null)

  useEffect(() => {
    setTheme(getStoredTheme())
  }, [])

  const handleSelect = (value) => {
    setTheme(value)
    applyTheme(value)
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      style={{
        display: 'flex',
        gap: '4px',
        padding: '4px',
        background: 'var(--bg-subtle)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      {OPTIONS.map(opt => {
        const Icon = opt.icon
        const active = theme === opt.value
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            onClick={() => handleSelect(opt.value)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 10px',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              background: active ? 'var(--surface)' : 'transparent',
              boxShadow: active ? 'var(--shadow-sm)' : 'none',
              color: active ? 'var(--text)' : 'var(--text-tertiary)',
              fontSize: '13px',
              fontWeight: active ? '700' : '500',
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'background 0.12s ease, color 0.12s ease, box-shadow 0.12s ease',
              // Visibility is gated on theme !== null (post-mount) rather than
              // this button being skipped entirely, so the control's layout
              // doesn't shift once it appears.
              visibility: theme === null ? 'hidden' : 'visible',
            }}
          >
            <Icon size={14} strokeWidth={2.25} />
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
