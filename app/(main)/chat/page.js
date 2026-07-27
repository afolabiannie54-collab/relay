'use client'

import ChatList from '@/components/chat/ChatList'

// The chat/layout.js shell already renders <ChatList /> in the persistent
// left panel and swaps this page's own render for <ChatEmptyState /> in the
// right panel whenever pathname === '/chat' — so on desktop this component's
// output is never actually mounted. It still renders <ChatList /> directly
// (rather than null) so the route has sane content before hydration and on
// any environment where that swap doesn't apply.
export default function ChatPage() {
  return <ChatList />
}
