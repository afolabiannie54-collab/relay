export default function ChatPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#F5F5F5',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <div style={{
        background: '#fff',
        border: '1.5px solid #0a0a0a',
        borderRadius: '12px',
        padding: '40px',
        boxShadow: '4px 4px 0 #0a0a0a',
        textAlign: 'center',
        maxWidth: '400px',
        width: '100%',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚡</div>
        <h1 style={{
          fontSize: '22px',
          fontWeight: '800',
          color: '#0a0a0a',
          marginBottom: '8px',
        }}>You're in.</h1>
        <p style={{
          fontSize: '14px',
          color: '#525252',
          lineHeight: '1.6',
        }}>
          Auth is working. Chat is coming in Phase 4.
        </p>
      </div>
    </div>
  )
}