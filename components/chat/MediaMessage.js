'use client'

import { useState, useEffect } from 'react'
import { getMediaForMessage } from '@/actions/messages'

export default function MediaMessage({ message, isOwn }) {
  const [media, setMedia] = useState(null)
  const [loading, setLoading] = useState(true)
  const [imageError, setImageError] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const result = await getMediaForMessage(message.id)
      if (result.data) setMedia(result.data)
      setLoading(false)
    }
    load()
  }, [message.id])

  if (loading) {
    return (
      <div style={{
        padding: '12px 14px',
        background: isOwn ? '#0a0a0a' : '#F5F5F5',
        borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
        border: '1.5px solid #0a0a0a',
        color: isOwn ? '#fff' : '#A3A3A3',
        fontSize: '13px',
      }}>
        Loading...
      </div>
    )
  }

  if (!media) {
    return (
      <div style={{
        padding: '12px 14px',
        background: isOwn ? '#0a0a0a' : '#F5F5F5',
        borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
        border: '1.5px solid #0a0a0a',
        color: isOwn ? '#fff' : '#525252',
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
          border: '1.5px solid #0a0a0a',
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
              background: '#F5F5F5',
              fontSize: '13px',
              color: '#525252',
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
                ⬇️
              </a>
              <button
                onClick={() => setLightboxOpen(false)}
                style={{
                  width: '40px',
                  height: '40px',
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '20px',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>
            <img
              src={media.url}
              alt={media.filename}
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
        background: isOwn ? '#0a0a0a' : '#F5F5F5',
        borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
        border: '1.5px solid #0a0a0a',
        minWidth: '200px',
      }}>
        <p style={{
          fontSize: '11px',
          color: isOwn ? '#A3A3A3' : '#525252',
          marginBottom: '8px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          🎙️ {media.filename.startsWith('voice-') ? 'Voice message' : media.filename}
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
      background: isOwn ? '#0a0a0a' : '#F5F5F5',
      borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
      border: '1.5px solid #0a0a0a',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      minWidth: '180px',
      maxWidth: '260px',
    }}>
      <div style={{
        width: '36px',
        height: '36px',
        background: isOwn ? '#333' : '#E5E5E5',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        flexShrink: 0,
      }}>
        📄
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '13px',
          fontWeight: '600',
          color: isOwn ? '#fff' : '#0a0a0a',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginBottom: '2px',
        }}>
          {media.filename}
        </p>
        <p style={{ fontSize: '11px', color: isOwn ? '#A3A3A3' : '#525252' }}>
          {formatSize(media.size)}
        </p>
      </div>
      <a
        href={media.url}
        download={media.filename}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          width: '30px',
          height: '30px',
          background: isOwn ? '#333' : '#E5E5E5',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          fontSize: '14px',
          flexShrink: 0,
        }}
        title="Download"
      >
        ⬇️
      </a>
    </div>
  )
}