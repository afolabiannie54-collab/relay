import { redirect } from 'next/navigation'

// Group creation now happens in NewConversationSheet's step 2 (opened
// from the + button on the chat list), not as a standalone page.
export default function CreateGroupPage() {
  redirect('/chat')
}
