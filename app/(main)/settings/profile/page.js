import { getOwnProfile } from '@/actions/users'
import EditProfileForm from '@/components/settings/EditProfileForm'

export default async function EditProfilePage() {
  const result = await getOwnProfile()

  return <EditProfileForm initialProfile={result.data} />
}
