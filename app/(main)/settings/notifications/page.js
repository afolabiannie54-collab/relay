import { createClient } from '@/lib/supabase/server'
import { getPrivacySettings } from '@/actions/users'
import NotificationSettingsForm from '@/components/settings/NotificationSettingsForm'

export default async function NotificationSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const result = await getPrivacySettings()

  return <NotificationSettingsForm initialSettings={result.data} userId={user?.id} />
}
