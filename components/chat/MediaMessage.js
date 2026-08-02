'use client'

import { useState } from 'react'
import { Download, X, Mic, FileText } from 'lucide-react'

const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

export default function MediaMessage({ message, isOwn }) {
  const [imageError, setImageError] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

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
      <>
        <div style={{
          borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
          border: isOwn ? '2px solid var(--accent)' : '2px solid var(--border-strong)',
          overflow: 'hidden',
          maxWidth: '280px',
          cursor: 'pointer',
        }}
          onClick={() => setLightboxOpen(true)}
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

        {lightboxOpen && (
          <div
            onClick={() => setLightboxOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.92)',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
          >
            <div style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              display: 'flex',
              gap: '12px',
            }}>
              <a
                href={media.url}
                download={media.filename}
                onClick={e => e.stopPropagation()}
                style={{
                  width: '40px',
                  height: '40px',
                  background: 'rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textDecoration: 'none',
                  fontSize: '18px',
                  color: '#fff',
                }}
                title="Download"
              >
                <Download size={18} {...iconProps} />
              </a>
              <button
                onClick={() => setLightboxOpen(false)}
                aria-label="Close"
                style={{
                  width: '40px',
                  height: '40px',
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} {...iconProps} />
              </button>
            </div>
            <img
              src={media.url}
              alt={media.filename}
              loading="lazy"
              onClick={e => e.stopPropagation()}
              style={{
                maxWidth: '100%',
                maxHeight: '85vh',
                objectFit: 'contain',
                borderRadius: '8px',
              }}
            />
            <p style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '12px',
              marginTop: '12px',
            }}>
              {media.filename}
            </p>
          </div>
        )}
      </>
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
        <audio
          controls
          src={media.url}
          style={{ width: '100%', height: '32px' }}
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
      <a
        href={media.url}
        download={media.filename}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Download"
        style={{
          width: '30px',
          height: '30px',
          background: isOwn ? 'rgba(255,255,255,0.12)' : 'var(--gray-200)',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          color: isOwn ? 'var(--background)' : 'var(--text-secondary)',
          flexShrink: 0,
        }}
        title="Download"
      >
        <Download size={14} {...iconProps} />
      </a>
    </div>
  )
}
