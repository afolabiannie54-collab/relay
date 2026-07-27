import { createClient } from '@/lib/supabase/server'
import { getPrivacySettings } from '@/actions/users'
import PrivacySettingsForm from '@/components/settings/PrivacySettingsForm'

export default async function PrivacySettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const result = await getPrivacySettings()

  return <PrivacySettingsForm initialSettings={result.data} userId={user?.id} />
}
