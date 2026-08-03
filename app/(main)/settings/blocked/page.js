import { redirect } from 'next/navigation'

// Blocked users now opens as a sheet from the Settings root page (see
// BlockedUsersSheet.js) rather than living at their own route.
export default function BlockedRedirectPage() {
  redirect('/settings')
}
