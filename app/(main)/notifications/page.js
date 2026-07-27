import { getNotifications } from '@/actions/notifications'
import NotificationList from '@/components/notifications/NotificationList'

export default async function NotificationsPage() {
  const result = await getNotifications()
  const initialNotifications = result.data || []

  return <NotificationList initialNotifications={initialNotifications} />
}
