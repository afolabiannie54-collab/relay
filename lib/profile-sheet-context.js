'use client'

import { createContext, useContext, useState, useCallback, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const ProfileSheetContext = createContext(null)

// The old /u/[username] route now just redirects to /chat?profile=...
// (for cold visits — a shared link, a bookmark, opened from outside
// the app) so that still works even though the route itself no longer
// renders a page — this reads that param once and opens the sheet.
// Isolated in its own component + Suspense boundary because
// useSearchParams() requires one; the Provider itself doesn't.
function ProfileFromUrl({ onOpen }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const fromUrl = searchParams.get('profile')
    if (!fromUrl) return
    onOpen(fromUrl)
    const params = new URLSearchParams(searchParams)
    params.delete('profile')
    const query = params.toString()
    router.replace(query ? `/chat?${query}` : '/chat')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return null
}

// A single profile sheet lives at the (main) layout level rather than
// being built fresh by each of the half-dozen places that used to
// router.push('/u/[username]') — search results, a conversation's
// header/settings, notifications, EditProfileForm's preview, etc. all
// just call openProfile(username) now and share the one overlay.
export function ProfileSheetProvider({ children }) {
  const [username, setUsername] = useState(null)

  const openProfile = useCallback((u) => setUsername(u), [])
  const closeProfile = useCallback(() => setUsername(null), [])

  return (
    <ProfileSheetContext.Provider value={{ username, openProfile, closeProfile }}>
      <Suspense fallback={null}>
        <ProfileFromUrl onOpen={openProfile} />
      </Suspense>
      {children}
    </ProfileSheetContext.Provider>
  )
}

export function useProfileSheet() {
  const ctx = useContext(ProfileSheetContext)
  if (!ctx) throw new Error('useProfileSheet must be used within ProfileSheetProvider')
  return ctx
}
