import { createClient } from '@/lib/supabase/server'
import { getMessageRequests, getSentMessageRequests } from '@/actions/messages'
import { getGroupInvites } from '@/actions/groups'
import RequestList from '@/components/requests/RequestList'

export default async function RequestsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [receivedResult, sentResult, invitesResult] = await Promise.all([
    getMessageRequests(),
    getSentMessageRequests(),
    getGroupInvites(),
  ])

  return (
    <RequestList
      initialReceived={receivedResult.data || []}
      initialSent={sentResult.data || []}
      initialInvites={invitesResult.data || []}
      userId={user?.id}
    />
  )
}
