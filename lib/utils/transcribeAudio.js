import { createClient as createServiceClient } from '@supabase/supabase-js'

// media has no UPDATE policy — only INSERT and SELECT — and adding one
// would mean handing users write access to url/filename/size too, since
// Postgres RLS can't scope a policy to individual columns. The transcript
// is written entirely server-side, so it uses the service role instead,
// same as sendPushNotification does for reading other people's rows.
function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Whisper's own ceiling is 25MB; uploadMedia already caps audio at 10MB,
// so this is a backstop rather than the real gate.
const MAX_BYTES = 25 * 1024 * 1024

async function setStatus(supabase, mediaId, status, transcript = null) {
  await supabase
    .from('media')
    .update({ transcript_status: status, transcript })
    .eq('id', mediaId)
}

// Fetches the uploaded clip back out of storage and transcribes it.
// Deliberately never throws: this runs detached from the request that
// created the message (see the after() call in uploadMedia), so an
// exception here has nobody to report to and must not be able to take
// anything else down. Every failure path lands on 'failed', which the UI
// renders as "Transcript unavailable" and never retries — a clip that
// can't be transcribed shouldn't be retried forever on every render.
export async function transcribeAudio(mediaId, audioUrl, mimeType) {
  const supabase = getServiceClient()

  if (!process.env.OPENAI_API_KEY) {
    await setStatus(supabase, mediaId, 'failed')
    return { error: 'Transcription is not configured' }
  }

  try {
    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) {
      await setStatus(supabase, mediaId, 'failed')
      return { error: 'Could not read the audio file' }
    }

    const buffer = await audioRes.arrayBuffer()
    if (buffer.byteLength > MAX_BYTES) {
      await setStatus(supabase, mediaId, 'failed')
      return { error: 'Audio too long to transcribe' }
    }

    // Whisper picks its decoder from the filename extension, not the MIME
    // type, so the name here has to carry a real one — a generic
    // "blob"/"upload" gets rejected as an unsupported format.
    const ext = (mimeType || '').includes('mp4') ? 'mp4'
      : (mimeType || '').includes('mpeg') ? 'mp3'
      : (mimeType || '').includes('wav') ? 'wav'
      : (mimeType || '').includes('ogg') ? 'ogg'
      : 'webm'

    const form = new FormData()
    form.append('file', new Blob([buffer], { type: mimeType || 'audio/webm' }), `audio.${ext}`)
    form.append('model', 'whisper-1')
    form.append('response_format', 'text')

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
    })

    if (!res.ok) {
      await setStatus(supabase, mediaId, 'failed')
      return { error: `Transcription failed (${res.status})` }
    }

    const text = (await res.text()).trim()

    // Silence and pure background noise come back empty. That's a
    // successful transcription of nothing, not a failure — but there's no
    // text worth showing, so it resolves to 'failed' (rendered as
    // unavailable) rather than an empty expandable panel.
    if (!text) {
      await setStatus(supabase, mediaId, 'failed')
      return { error: 'Nothing to transcribe' }
    }

    await setStatus(supabase, mediaId, 'done', text)
    return { success: true }
  } catch {
    await setStatus(supabase, mediaId, 'failed')
    return { error: 'Transcription failed' }
  }
}
