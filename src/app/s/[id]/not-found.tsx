export default function NotFound() {
  return (
    <main
      style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: '120px 24px',
        textAlign: 'center',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 18,
      }}
    >
      <p
        style={{
          fontSize: 11,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: 'var(--accent)',
          fontWeight: 600,
          margin: 0,
        }}
      >
        404 · Vanished
      </p>
      <h1
        style={{
          fontFamily: 'Fraunces, serif',
          fontWeight: 400,
          fontSize: 'clamp(40px, 8vw, 72px)',
          letterSpacing: '-0.03em',
          lineHeight: 1,
          margin: 0,
        }}
      >
        Sheet not found <em style={{ color: 'var(--accent)' }}>or expired</em>.
      </h1>
      <p style={{ color: 'var(--ink-2)', fontSize: 17, lineHeight: 1.55, margin: 0 }}>
        It either never existed or has quietly passed its TTL and been swept away.
      </p>
      <p style={{ marginTop: 12 }}>
        <a
          href="/"
          style={{
            display: 'inline-block',
            padding: '14px 22px',
            background: 'var(--ink)',
            color: 'var(--paper)',
            textDecoration: 'none',
            fontWeight: 600,
            border: '1px solid var(--ink)',
          }}
        >
          ← Create a new one
        </a>
      </p>
    </main>
  );
}
