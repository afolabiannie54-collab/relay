'use client'

import { useState } from 'react'
import { Download, Mic, FileText } from 'lucide-react'
import AudioPlayer from '@/components/chat/AudioPlayer'

const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

// media.url is a Supabase Storage public URL — a different origin from
// this app — and browsers silently ignore the `download` attribute on a
// cross-origin <a href>, so tapping "Download" just opened/navigated to
// the file instead of actually saving it. Fetching it as a blob first
// gives a same-origin (blob:) URL that the browser will actually save.
// Falls back to opening it directly only if the fetch itself fails (e.g.
// a network blip, or a storage CORS policy stricter than the standard
// public-bucket default).
async function downloadFile(url, filename) {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename || 'download'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

// Collapsed by default: a voice note is still primarily something you
// play, and expanding every transcript inline would turn a compact bubble
// into a wall of text. 'skipped' (sender turned transcription off) renders
// nothing at all rather than advertising a setting that isn't the
// recipient's to change.
function AudioTranscript({ status, transcript, isOwn }) {
  const [open, setOpen] = useState(false)

  if (status === 'none' || status === 'skipped') return null

  const subtle = isOwn ? 'var(--text-tertiary)' : 'var(--text-secondary)'

  if (status === 'pending') {
    return (
      <p style={{ marginTop: '8px', fontSize: '11px', color: subtle, fontStyle: 'italic' }}>
        Transcribing…
      </p>
    )
  }

  if (status === 'failed' || !transcript) {
    return (
      <p style={{ marginTop: '8px', fontSize: '11px', color: subtle }}>
        Transcript unavailable
      </p>
    )
  }

  return (
    <div style={{ marginTop: '8px' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: '11px',
          fontWeight: '700',
          color: subtle,
        }}
      >
        <FileText size={11} {...iconProps} />
        {open ? 'Hide transcript' : 'Show transcript'}
      </button>
      {open && (
        <p style={{
          marginTop: '6px',
          fontSize: '13px',
          lineHeight: 1.5,
          color: isOwn ? 'var(--background)' : 'var(--text)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {transcript}
        </p>
      )}
    </div>
  )
}

export default function MediaMessage({ message, isOwn, onOpenLightbox }) {
  const [imageError, setImageError] = useState(false)

  const media = message.media_url
    ? {
        url: message.media_url,
        filename: message.media_filename,
        size: message.media_size,
        mimeType: message.media_mime_type,
      }
    : null

  if (!media) {
    return (
      <div style={{
        padding: '12px 14px',
        background: isOwn ? 'var(--text)' : 'var(--gray-100)',
        borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
        border: isOwn ? '2px solid var(--accent)' : '2px solid var(--border-strong)',
        color: isOwn ? 'var(--background)' : 'var(--text-secondary)',
        fontSize: '13px',
      }}>
        {message.content || 'File'}
      </div>
    )
  }

  if (message.type === 'image') {
    return (
      <div style={{
        borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
        border: isOwn ? '2px solid var(--accent)' : '2px solid var(--border-strong)',
        overflow: 'hidden',
        maxWidth: '280px',
        cursor: 'pointer',
      }}
        onClick={() => onOpenLightbox?.(message.id)}
      >
        {!imageError ? (
          <img
            src={media.url}
            alt={media.filename}
            loading="lazy"
            onError={() => setImageError(true)}
            style={{
              width: '100%',
              display: 'block',
              maxHeight: '300px',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div style={{
            padding: '16px',
            background: 'var(--gray-100)',
            fontSize: '13px',
            color: 'var(--text-secondary)',
          }}>
            Could not load image
          </div>
        )}
      </div>
    )
  }

  if (message.type === 'audio') {
    return (
      <div style={{
        padding: '12px 14px',
        background: isOwn ? 'var(--text)' : 'var(--gray-100)',
        borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
        border: isOwn ? '2px solid var(--accent)' : '2px solid var(--border-strong)',
        minWidth: '200px',
      }}>
        <p style={{
          fontSize: '11px',
          color: isOwn ? 'var(--text-tertiary)' : 'var(--text-secondary)',
          marginBottom: '8px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          <Mic size={12} {...iconProps} /> {media.filename.startsWith('voice-') ? 'Voice message' : media.filename}
        </p>
        <AudioPlayer src={media.url} light={isOwn} />
        <AudioTranscript
          status={message.media_transcript_status}
          transcript={message.media_transcript}
          isOwn={isOwn}
        />
      </div>
    )
  }

  // File/document
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div style={{
      padding: '12px 14px',
      background: isOwn ? 'var(--text)' : 'var(--gray-100)',
      borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
      border: isOwn ? '2px solid var(--accent)' : '2px solid var(--border-strong)',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      minWidth: '180px',
      maxWidth: '260px',
    }}>
      <div style={{
        width: '36px',
        height: '36px',
        background: isOwn ? 'rgba(255,255,255,0.12)' : 'var(--gray-200)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isOwn ? 'var(--background)' : 'var(--text-secondary)',
        flexShrink: 0,
      }}>
        <FileText size={18} {...iconProps} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '13px',
          fontWeight: '600',
          color: isOwn ? 'var(--background)' : 'var(--text)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginBottom: '2px',
        }}>
          {media.filename}
        </p>
        <p style={{ fontSize: '11px', color: isOwn ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>
          {formatSize(media.size)}
        </p>
      </div>
      <button
        onClick={() => downloadFile(media.url, media.filename)}
        aria-label="Download"
        style={{
          width: '30px',
          height: '30px',
          background: isOwn ? 'rgba(255,255,255,0.12)' : 'var(--gray-200)',
          border: 'none',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: isOwn ? 'var(--background)' : 'var(--text-secondary)',
          flexShrink: 0,
        }}
        title="Download"
      >
        <Download size={14} {...iconProps} />
      </button>
    </div>
  )
}
