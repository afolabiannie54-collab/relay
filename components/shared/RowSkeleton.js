import Skeleton from '@/components/shared/Skeleton'

// Avatar + two-line row placeholder, matching the shape shared by
// BlockedUserRow and SessionRow (44px circle, ~140px name line, shorter
// subtitle line) — reused by both sheets rather than duplicated, since
// they render identically shaped rows for genuinely different data.
export default function RowSkeleton({ isLast = false }) {
  return (
    <div style={{
      padding: '14px 20px',
      borderBottom: isLast ? 'none' : '1px solid var(--border-light)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    }}>
      <Skeleton width="44px" height="44px" borderRadius="50%" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Skeleton width="140px" height="14px" style={{ marginBottom: '6px' }} />
        <Skeleton width="90px" height="12px" />
      </div>
    </div>
  )
}
