import ChatServiceIllustration from '@/components/shared/illustrations/ChatServiceIllustration'

export default function ChatEmptyState() {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--surface)',
      textAlign: 'center',
      padding: '40px',
    }}>
      <div style={{ marginBottom: '12px' }}>
        <ChatServiceIllustration size={300} />
      </div>
      <p style={{ fontSize: '15px', color: 'var(--text-tertiary)', fontWeight: '500' }}>
        Select a conversation to start messaging
      </p>
    </div>
  )
}
