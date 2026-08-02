import { redirect } from 'next/navigation'

// Profile viewing moved to a shared sheet (components/profile/ProfileSheet.js)
// opened from wherever "view profile" is triggered, rather than a routed
// page — but this URL is still shared/bookmarked (the sheet's own "Share
// profile" action copies it), so it has to keep working for a cold visit.
// Redirecting into /chat?profile=username lets ProfileSheetProvider pick
// the username back up and open the sheet on top of the chat shell.
export default async function ProfileRedirectPage({ params }) {
  const { username } = await params
  redirect(`/chat?profile=${encodeURIComponent(username)}`)
}
