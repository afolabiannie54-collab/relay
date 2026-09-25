'use client'

import { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'
import BottomSheet from '@/components/shared/BottomSheet'
import { getCroppedImageBlob } from '@/lib/cropImage'

// Sits between file selection and upload so the user picks what part of
// the photo actually shows as their (circular) avatar, instead of
// whatever the raw file's center happened to be.
export default function AvatarCropModal({ imageSrc, onCancel, onConfirm }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [processing, setProcessing] = useState(false)

  const handleCropComplete = useCallback((_, areaPixels) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  const handleConfirm = async () => {
    if (!croppedAreaPixels || processing) return
    setProcessing(true)
    const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels)
    setProcessing(false)
    onConfirm(blob)
  }

  return (
    <BottomSheet isOpen onClose={onCancel} title="Adjust photo">
      <div style={{ padding: '16px 20px 20px' }}>
        <div style={{
          position: 'relative',
          width: '100%',
          height: '320px',
          background: '#111',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
        }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '18px 0 4px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ flex: 1 }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            className="relay-btn"
            style={{ flex: 1 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={processing || !croppedAreaPixels}
            className="relay-btn relay-btn--filled"
            style={{ flex: 1, boxShadow: 'var(--shadow-hard-accent)' }}
          >
            {processing ? 'Saving...' : 'Use photo'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
