// Shared server-side input sanitization: trims whitespace, strips any
// HTML tags (so raw markup never reaches storage — belt-and-suspenders
// alongside React's default text-content escaping, for any place that
// might one day render this content unescaped, e.g. push notification
// bodies, email digests, exports), and enforces a max length. Every
// server action that persists user-typed text should route it through
// this rather than trusting client-side limits, since actions can be
// called directly regardless of what the UI enforces.
export function sanitizeText(value, maxLength) {
  if (typeof value !== 'string') return ''
  const stripped = value.replace(/<[^>]*>/g, '')
  const trimmed = stripped.trim()
  return typeof maxLength === 'number' ? trimmed.slice(0, maxLength) : trimmed
}
