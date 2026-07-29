'use client'

import BottomSheet from '@/components/shared/BottomSheet'

// Replaces browser confirm() everywhere in the app. confirmStyle:
// 'danger' renders the confirm button red (destructive actions like
// delete/leave/block); 'default' renders it in the app's normal accent.
export default function ConfirmSheet({
  isOpen,
  onClose,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmStyle = 'default',
  onConfirm,
}) {
  const handleConfirm = () => {
    onConfirm?.()
    onClose?.()
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <div style={{ padding: '16px 20px 24px' }}>
        {message && (
          <p style={{
            fontSize: '14px',
            color: '#525252',
            lineHeight: '1.5',
            marginBottom: '20px',
          }}>
            {message}
          </p>
        )}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '10px',
              border: '1.5px solid #0a0a0a',
              background: '#fff',
              color: '#0a0a0a',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              fontFamily: 'inherit',
              minHeight: '44px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '10px',
              border: '1.5px solid #0a0a0a',
              background: confirmStyle === 'danger' ? '#EF4444' : '#0a0a0a',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              fontFamily: 'inherit',
              minHeight: '44px',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
