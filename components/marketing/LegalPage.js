// Shared shell for /privacy and /terms so both stay visually identical and
// only their body content differs. Kept narrow (68ch) — legal text is the
// one place on this site where line length matters more than impact.
export default function LegalPage({ title, updated, children }) {
  return (
    <article style={{ maxWidth: '760px', margin: '0 auto', padding: 'clamp(40px, 7vw, 80px) 24px' }}>
      <h1 style={{
        fontSize: 'clamp(2.25rem, 6vw, 3.5rem)',
        fontWeight: '900',
        letterSpacing: '-0.04em',
        lineHeight: 1.03,
        color: 'var(--text)',
        marginBottom: '12px',
      }}>
        {title}
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '36px' }}>
        Last updated {updated}
      </p>
      <div className="legal-body">{children}</div>
    </article>
  )
}

export function Section({ heading, children }) {
  return (
    <section style={{ marginBottom: '32px' }}>
      <h2 style={{
        fontSize: 'clamp(1.25rem, 2.4vw, 1.6rem)',
        fontWeight: '900',
        letterSpacing: '-0.02em',
        color: 'var(--text)',
        marginBottom: '12px',
      }}>
        {heading}
      </h2>
      <div style={{ fontSize: '15px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
        {children}
      </div>
    </section>
  )
}

export function P({ children }) {
  return <p style={{ marginBottom: '12px' }}>{children}</p>
}

export function List({ items }) {
  return (
    <ul style={{ margin: '0 0 12px', paddingLeft: '20px', listStyle: 'disc' }}>
      {items.map((item, i) => (
        <li key={i} style={{ marginBottom: '6px' }}>{item}</li>
      ))}
    </ul>
  )
}
