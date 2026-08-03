'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

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
      aria-label={copied ? 'Copied' : 'Copy username'}
      title={copied ? 'Copied' : 'Copy username'}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: copied ? 'var(--success)' : 'var(--text-tertiary)',
        padding: '3px',
      }}
    >
      {copied ? <Check size={12} {...iconProps} /> : <Copy size={12} {...iconProps} />}
    </button>
  )
}
