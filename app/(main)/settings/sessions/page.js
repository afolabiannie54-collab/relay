import { redirect } from 'next/navigation'

// Active sessions now opens as a sheet from the Settings root page (see
// ActiveSessionsSheet.js) rather than living at their own route.
export default function SessionsRedirectPage() {
  redirect('/settings')
}
