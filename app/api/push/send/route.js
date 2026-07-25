import { sendPushNotification } from '@/lib/utils/sendPushNotification'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request) {
  try {
    const { userId, title, body, url } = await request.json()

    if (!userId || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const result = await sendPushNotification(userId, title, body, url)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Push notification error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
