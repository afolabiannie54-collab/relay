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
      {/* Temporary: the real freebie-pack asset, unedited, for review
          against the hand-built EmptyChatsIllustration before deciding
          which one sticks. */}
      <div style={{ marginBottom: '12px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/illustrations/ec-chat-service-circle.svg" alt="" width={220} height={241} />
      </div>
      <p style={{ fontSize: '15px', color: 'var(--text-tertiary)', fontWeight: '500' }}>
        Select a conversation to start messaging
      </p>
    </div>
  )
}
