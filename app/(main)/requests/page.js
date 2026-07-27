import { createClient } from '@/lib/supabase/server'
import { getMessageRequests } from '@/actions/messages'
import RequestList from '@/components/requests/RequestList'

export default async function RequestsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const result = await getMessageRequests()
  const initialRequests = result.data || []

  return <RequestList initialRequests={initialRequests} userId={user?.id} />
}
