import { getPrivacySettings } from '@/actions/users'
import PrivacySettingsForm from '@/components/settings/PrivacySettingsForm'

export default async function PrivacySettingsPage() {
  const result = await getPrivacySettings()

  return <PrivacySettingsForm initialSettings={result.data} />
}
