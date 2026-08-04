'use client'

import { useState, useEffect } from 'react'
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
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState(null)

  // Stale error from a previous open shouldn't flash before the next
  // attempt's own result comes back.
  useEffect(() => {
    if (isOpen) setError(null)
  }, [isOpen])

  // onConfirm (e.g. deleteGroup, a ~10-round-trip server action) used to
  // fire without being awaited, so this closed immediately while the real
  // action was still in flight — whatever the caller does after it
  // resolves (closing a parent sheet, navigating away) then landed a
  // second or two later, after the user had already moved on, reading as
  // an unexplained extra navigation. Awaiting it here means onClose only
  // fires once the action has actually finished.
  //
  // Callers are expected to `return` whatever their server action
  // returns. If that comes back as { error }, or the call throws outright,
  // this sheet now stays open and shows why instead of closing exactly
  // like a success would — previously neither case was distinguishable
  // from the user's side, so a failed delete/leave/block/remove looked
  // identical to one that worked.
  const handleConfirm = async () => {
    setConfirming(true)
    setError(null)
    try {
      const result = await onConfirm?.()
      if (result?.error) {
        setError(result.error)
        return
      }
      onClose?.()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <div style={{ padding: '16px 20px 24px' }}>
        {message && (
          <p style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            lineHeight: '1.55',
            marginBottom: '20px',
          }}>
            {message}
          </p>
        )}
        {error && (
          <div style={{
            background: 'var(--error-light)',
            border: '1.5px solid var(--error)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            marginBottom: '16px',
            fontSize: '13px',
            color: 'var(--error)',
          }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onClose}
            disabled={confirming}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: '14px',
              fontWeight: '600',
              cursor: confirming ? 'not-allowed' : 'pointer',
              opacity: confirming ? 0.5 : 1,
              fontFamily: 'inherit',
              minHeight: '44px',
              transition: 'background 0.12s ease',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: confirmStyle === 'danger' ? 'var(--error)' : 'var(--text)',
              color: confirmStyle === 'danger' ? '#fff' : 'var(--background)',
              fontSize: '14px',
              fontWeight: '700',
              cursor: confirming ? 'not-allowed' : 'pointer',
              opacity: confirming ? 0.7 : 1,
              fontFamily: 'inherit',
              minHeight: '44px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {confirming ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
