'use client'

import { useState } from 'react'

export default function CopyUsernameButton({ username }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`@${username}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  if (!username) return null

  return (
    <button
      onClick={handleCopy}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '11px',
        color: copied ? '#22C55E' : '#A3A3A3',
        fontFamily: 'inherit',
        fontWeight: '600',
        padding: '2px 6px',
        borderRadius: '4px',
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}
