// Shared shell for every auth screen (login, signup, reset-password,
// verify, setup-username) — one full-height centered card on a plain
// background. Previously each page re-declared this identical wrapper
// with its own hardcoded hex, which is also why none of them supported
// dark mode until now.
export default function AuthShell({ children, maxWidth = '440px' }) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth }}>
        <div style={{
          background: 'var(--surface)',
          border: '1.5px solid var(--border-strong)',
          borderRadius: 'var(--radius-lg)',
          padding: '40px',
          boxShadow: 'var(--shadow-hard-md)',
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}
