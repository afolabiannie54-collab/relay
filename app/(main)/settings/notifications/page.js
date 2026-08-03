import { redirect } from 'next/navigation'

// Notification preferences now open as a sheet from the Settings root page
// (see NotificationSettingsSheet.js) rather than living at their own route.
export default function NotificationsRedirectPage() {
  redirect('/settings')
}
