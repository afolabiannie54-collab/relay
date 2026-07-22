'use client'

import Image from 'next/image'

function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function getAvatarColor(name) {
  if (!name) return '#A3A3A3'
  const colors = [
    '#FFB800', '#FF4D6D', '#8B5CF6', '#3B82F6',
    '#22C55E', '#F59E0B', '#EF4444', '#06B6D4',
    '#EC4899', '#14B8A6', '#F97316', '#6366F1',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export default function Avatar({ src, name, size = 40, className }) {
  const initials = getInitials(name)
  const bgColor = getAvatarColor(name)
  const fontSize = size * 0.38

  if (src) {
    return (
      <div style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        border: '1.5px solid #0a0a0a',
        flexShrink: 0,
        position: 'relative',
      }}>
        <Image
          src={src}
          alt={name || 'Avatar'}
          fill
          style={{ objectFit: 'cover' }}
        />
      </div>
    )
  }

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: bgColor,
      border: '1.5px solid #0a0a0a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      fontSize,
      fontWeight: '700',
      color: '#0a0a0a',
      fontFamily: "'Inter', -apple-system, sans-serif",
      userSelect: 'none',
    }}>
      {initials}
    </div>
  )
}