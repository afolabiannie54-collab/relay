export async function sendPushNotification(userId, title, body, url) {
  try {
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
      .replace(/\/$/, '')
      .replace(/^http:/, 'https:')

    const response = await fetch(`${baseUrl}/api/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, title, body, url }),
      redirect: 'follow',
    })
    if (!response.ok) {
      console.error('Push notification failed:', response.status, await response.text())
    }
  } catch (err) {
    console.error('Failed to send push notification:', err)
  }
}
