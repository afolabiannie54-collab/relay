import { createClient } from '@/lib/supabase/server'
import { getMessageRequests, getSentMessageRequests } from '@/actions/messages'
import RequestList from '@/components/requests/RequestList'

export default async function RequestsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [receivedResult, sentResult] = await Promise.all([
    getMessageRequests(),
    getSentMessageRequests(),
  ])

  return (
    <RequestList
      initialReceived={receivedResult.data || []}
      initialSent={sentResult.data || []}
      userId={user?.id}
    />
  )
}
