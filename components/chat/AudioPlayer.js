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
  const trackRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  // Only a single tap-to-jump existed before (onClick on the track) —
  // no drag/scrub, and no visible thumb to grab, so the bar didn't read
  // as something you could actually control the position with, just a
  // static progress indicator that happened to also respond to a tap.
  const [dragging, setDragging] = useState(false)

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

  const seekToClientX = (clientX) => {
    const audio = audioRef.current
    const track = trackRef.current
    if (!audio || !track || !duration) return
    const rect = track.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    // Set optimistically rather than waiting on the audio element's own
    // timeupdate event — that only fires a few times a second, which
    // reads as laggy while actively dragging the thumb.
    audio.currentTime = ratio * duration
    setCurrentTime(ratio * duration)
  }

  // Pointer Events (not separate mouse/touch handlers) so mouse and touch
  // drags share one code path. setPointerCapture keeps this element
  // receiving move/up events even once the pointer leaves its bounds —
  // required for a natural drag gesture; without it, dragging past the
  // bar's edges would silently stop tracking.
  const handlePointerDown = (e) => {
    if (!duration) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    seekToClientX(e.clientX)
  }

  const handlePointerMove = (e) => {
    if (!dragging) return
    seekToClientX(e.clientX)
  }

  const handlePointerUp = () => {
    setDragging(false)
  }

  const progress = duration ? (currentTime / duration) * 100 : 0
  const fg = light ? 'var(--background)' : 'var(--text)'
  const track = light ? 'rgba(255,255,255,0.3)' : 'var(--border)'
  const showTime = currentTime > 0 ? currentTime : duration

  return (
    // data-no-message-swipe: read by the conversation page's swipe-to-
    // reply handler on the message bubble this sits inside — scrubbing
    // the track below is itself a sustained horizontal drag, which would
    // otherwise also bubble up and arm/trigger a reply swipe on the
    // bubble underneath it.
    <div data-no-message-swipe style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
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
        {/* Padded above/below (negative margin cancels the layout impact)
            so the actual draggable hit target is taller than the 4px
            visual bar — dragging a 4px-tall line by touch is unreliable. */}
        <div
          ref={trackRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            padding: '10px 0',
            margin: '-10px 0',
            cursor: 'pointer',
            touchAction: 'none',
          }}
        >
          <div style={{ height: '4px', borderRadius: '2px', background: track, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${progress}%`, background: fg, borderRadius: '2px' }} />
            <div style={{
              position: 'absolute',
              left: `${progress}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: dragging ? '14px' : '10px',
              height: dragging ? '14px' : '10px',
              borderRadius: '50%',
              background: fg,
              boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
              transition: dragging ? 'none' : 'width 0.12s ease, height 0.12s ease',
            }} />
          </div>
        </div>
      </div>
      <span style={{ fontSize: '11px', fontWeight: '600', fontVariantNumeric: 'tabular-nums', color: fg, flexShrink: 0 }}>
        {formatTime(showTime)}
      </span>
    </div>
  )
}
