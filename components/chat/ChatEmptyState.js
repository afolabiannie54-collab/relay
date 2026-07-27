export default function ChatEmptyState() {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#fff',
      textAlign: 'center',
      padding: '40px',
    }}>
      <div style={{ fontSize: '72px', marginBottom: '16px' }}>💬</div>
      <p style={{ fontSize: '15px', color: '#A3A3A3', fontWeight: '500' }}>
        Select a conversation to start messaging
      </p>
    </div>
  )
}
