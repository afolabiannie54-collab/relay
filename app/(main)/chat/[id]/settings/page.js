import { redirect } from 'next/navigation'

// Conversation settings now live in ConversationSettingsSheet, opened
// from the conversation page itself (header tap or the ℹ️ button) —
// not a standalone page.
export default async function ConversationSettingsPage({ params }) {
  const { id } = await params
  redirect(`/chat/${id}`)
}
