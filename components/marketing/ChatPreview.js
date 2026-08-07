import { Check, CheckCheck, Mic, FileText, Star } from 'lucide-react'

const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

// The product shot, drawn in markup rather than screenshotted. It reads
// from the same tokens as the real chat, so it can't drift out of date the
// way a PNG does, stays crisp on any display, and adapts to light/dark
// automatically — a screenshot would need re-taking for both themes.
function Bubble({ own, children, meta }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: own ? 'flex-end' : 'flex-start', gap: '3px' }}>
      <div style={{
        maxWidth: '78%',
        padding: '10px 14px',
        fontSize: '14px',
        lineHeight: 1.45,
        background: own ? 'var(--text)' : 'var(--surface)',
        color: own ? 'var(--background)' : 'var(--text)',
        border: own ? '2px solid var(--accent)' : '2px solid var(--border-strong)',
        borderRadius: own ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
        fontWeight: '500',
      }}>
        {children}
      </div>
      {meta && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--text-tertiary)' }}>
          {meta}
        </div>
      )}
    </div>
  )
}

export default function ChatPreview() {
  return (
    <div style={{
      background: 'var(--bg-subtle)',
      border: '3px solid var(--border-strong)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-hard-lg)',
      overflow: 'hidden',
      width: '100%',
      maxWidth: '420px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 16px',
        background: 'var(--surface)',
        borderBottom: '2px solid var(--border-strong)',
      }}>
        <div style={{
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          background: 'var(--accent)',
          border: '2px solid var(--border-strong)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '13px',
          fontWeight: '900',
          color: 'var(--on-accent)',
          flexShrink: 0,
        }}>M</div>
        <div>
          <p style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.01em' }}>Maya</p>
          <p style={{ fontSize: '11px', color: 'var(--success)', fontWeight: '600' }}>● Online</p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <Bubble>found you by username — no number needed 👀</Bubble>

        <Bubble own meta={<><span>09:41</span><CheckCheck size={12} {...iconProps} color="var(--accent)" /></>}>
          that&apos;s the whole idea
        </Bubble>

        {/* Voice note with transcript — the differentiator, shown rather
            than described. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px' }}>
          <div style={{
            padding: '12px 14px',
            background: 'var(--surface)',
            border: '2px solid var(--border-strong)',
            borderRadius: '4px 16px 16px 16px',
            minWidth: '230px',
          }}>
            <p style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: '600',
            }}>
              <Mic size={12} {...iconProps} /> Voice message
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                border: '2px solid var(--border-strong)',
                background: 'var(--surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <div style={{
                  width: 0,
                  height: 0,
                  borderTop: '5px solid transparent',
                  borderBottom: '5px solid transparent',
                  borderLeft: '8px solid var(--text)',
                  marginLeft: '2px',
                }} />
              </div>
              <div style={{ flex: 1, height: '4px', background: 'var(--border)', borderRadius: '2px' }}>
                <div style={{ width: '38%', height: '100%', background: 'var(--text)', borderRadius: '2px' }} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)' }}>0:07</span>
            </div>
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
              <p style={{
                fontSize: '11px',
                fontWeight: '800',
                color: 'var(--accent-text)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginBottom: '5px',
              }}>
                <FileText size={11} {...iconProps} /> Transcript
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5 }}>
                Can&apos;t talk right now — read this instead.
              </p>
            </div>
          </div>
        </div>

        <Bubble
          own
          meta={<>
            <Star size={11} strokeWidth={2} fill="var(--accent)" color="var(--accent)" />
            <span>09:42</span>
            <CheckCheck size={12} {...iconProps} color="var(--accent)" />
          </>}
        >
          perfect, starred it
        </Bubble>
      </div>
    </div>
  )
}
