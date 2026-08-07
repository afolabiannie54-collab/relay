'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause } from 'lucide-react'

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// Replaces the bare native <audio controls> element everywhere a voice
// message shows up (a sent bubble, the pre-send recorder preview) — the
// native control's browser chrome read as an unstyled island next to
// everything else that's hand-drawn/tokenized. The <audio> tag itself
// stays as the actual playback engine (display: none), just with a
// custom play/pause + seek bar driven off its own events.
// `light` flips the palette for use on a dark surface (an own-message
// bubble), same idea as MediaMessage's own isOwn color branches.
export default function AudioPlayer({ src, light = false }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTime = () => setCurrentTime(audio.currentTime)
    const onEnded = () => { setPlaying(false); setCurrentTime(0) }
    // Driven off the element's own events rather than assumed from the
    // click, so a play() the browser refuses (autoplay policy, decode
    // failure) can't leave a pause icon on something that isn't playing.
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)

    // A clip recorded by MediaRecorder is written as a stream, so its
    // container carries no duration in the header and the browser reports
    // Infinity. That's why every voice note read 0:00 and the progress bar
    // never moved: formatTime(Infinity) falls back to 0:00 and
    // currentTime / Infinity is always 0. Seeking far past the end forces
    // the browser to scan the file and emit a real duration, after which
    // the position is put back. Applies to clips already uploaded too, so
    // this fixes existing voice notes and not just new ones.
    const onDurationChange = () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration)
        audio.removeEventListener('durationchange', onDurationChange)
        audio.currentTime = 0
      }
    }

    const onLoaded = () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration)
        return
      }
      audio.addEventListener('durationchange', onDurationChange)
      try { audio.currentTime = 1e101 } catch {}
    }

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)

    // Metadata can already be loaded before this effect runs (a cached
    // clip), in which case loadedmetadata has been and gone.
    if (audio.readyState >= 1) onLoaded()

    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('durationchange', onDurationChange)
    }
  }, [src])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
    } else {
      // play() rejects on iOS if the media can't decode; swallowing it
      // silently would leave the UI mid-state, so the pause/play listeners
      // above own the icon and this only reports the failure.
      audio.play().catch(() => setPlaying(false))
    }
  }

  const handleSeek = (e) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    audio.currentTime = ratio * duration
    setCurrentTime(ratio * duration)
  }

  const progress = duration ? (currentTime / duration) * 100 : 0
  const fg = light ? 'var(--background)' : 'var(--text)'
  const track = light ? 'rgba(255,255,255,0.3)' : 'var(--border)'
  const showTime = currentTime > 0 ? currentTime : duration

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
      <audio ref={audioRef} src={src} preload="metadata" style={{ display: 'none' }} />
      <button
        onClick={togglePlay}
        aria-label={playing ? 'Pause' : 'Play'}
        style={{
          width: '30px',
          height: '30px',
          borderRadius: '50%',
          flexShrink: 0,
          border: `2px solid ${fg}`,
          background: 'none',
          color: fg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        {playing
          ? <Pause size={13} fill={fg} strokeWidth={0} />
          : <Play size={13} fill={fg} strokeWidth={0} style={{ marginLeft: '2px' }} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          onClick={handleSeek}
          style={{ height: '4px', borderRadius: '2px', background: track, cursor: 'pointer', position: 'relative' }}
        >
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${progress}%`, background: fg, borderRadius: '2px' }} />
        </div>
      </div>
      <span style={{ fontSize: '11px', fontWeight: '600', fontVariantNumeric: 'tabular-nums', color: fg, flexShrink: 0 }}>
        {formatTime(showTime)}
      </span>
    </div>
  )
}
