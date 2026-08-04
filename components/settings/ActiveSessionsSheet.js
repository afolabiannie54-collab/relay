'use client'

import { useState, useEffect } from 'react'
import BottomSheet from '@/components/shared/BottomSheet'
import NotionDoodle from '@/components/shared/illustrations/NotionDoodle'
import RowSkeleton from '@/components/shared/RowSkeleton'
import SessionRow from '@/components/settings/SessionRow'
import { getActiveSessions } from '@/actions/sessions'

// Pulled from the same Notion-Resources-Freebie pack as the other empty-state
// doodles (ni-laptop-fill, Regular set) — a laptop reads as "device/session"
// without needing a literal screenshot of a browser tab.
const LAPTOP_PATH = "M3.43528 14.9875V6.50468C3.43528 6.40152 3.41387 6.29958 3.39798 6.19754C3.31655 5.67436 3.62589 4.77669 5.44055 4.42925C7.94713 3.94933 19.9787 3.46942 20.48 5.38909C20.8811 6.92483 20.6471 12.108 20.48 14.5076M22.9866 17.387C22.9155 17.6594 22.8268 17.9008 22.723 18.1149M22.9866 17.387L1.05712 17.818M22.9866 17.387C23.0594 17.1082 22.8324 16.8833 22.3687 16.7037M2.43265 19.4747C2.61681 19.6104 2.79073 19.7181 2.93397 19.7867C3.9366 20.2666 17.4721 19.7867 18.9761 19.7867C19.8883 19.7867 20.9458 19.7603 21.7723 19.2201M2.43265 19.4747L21.7723 19.2201M2.43265 19.4747C2.25028 19.3403 2.05788 19.1784 1.87532 19M21.7723 19.2201C21.9893 19.0783 22.1903 18.9011 22.3687 18.6797M22.3687 18.6797L1.87532 19M22.3687 18.6797C22.5 18.5166 22.6191 18.3295 22.723 18.1149M1.87532 19C1.71532 18.8436 1.56287 18.6745 1.43136 18.5M1.43136 18.5L22.723 18.1149M1.43136 18.5C1.26287 18.2764 1.12875 18.044 1.05712 17.818M1.05712 17.818C0.985681 17.5927 0.976384 17.3739 1.05712 17.1767M1.05712 17.1767C1.19699 16.8352 1.60715 16.5589 2.43265 16.4272C8.71707 16.1537 19.6403 15.6467 22.3687 16.7037M1.05712 17.1767L22.3687 16.7037"

export default function ActiveSessionsSheet({ isOpen, onClose }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setError(null)
    getActiveSessions().then(result => {
      if (result.error) setError(result.error)
      setSessions(result.data || [])
      setLoading(false)
    })
  }, [isOpen])

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Active sessions">
      <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
        {error && (
          <div style={{
            background: 'var(--error-light)',
            border: '1.5px solid var(--error)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            margin: '12px 20px 0',
            fontSize: '13px',
            color: 'var(--error)',
          }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '4px 0' }}>
            <RowSkeleton />
            <RowSkeleton isLast />
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px 40px', textAlign: 'center' }}>
            <div style={{ marginBottom: '12px' }}>
              <NotionDoodle d={LAPTOP_PATH} size={110} />
            </div>
            <h2 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text)', marginBottom: '4px', letterSpacing: '-0.01em' }}>No active sessions</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
              Devices signed into your account will show up here.
            </p>
          </div>
        ) : (
          <div style={{ padding: '4px 0' }}>
            {sessions.map((session, i) => (
              <SessionRow
                key={session.id}
                session={session}
                isLast={i === sessions.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
