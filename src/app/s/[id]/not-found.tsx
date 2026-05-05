export default function NotFound() {
  return (
    <main
      style={{
        maxWidth: 520,
        margin: '0 auto',
        padding: '120px 24px',
        textAlign: 'center',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 500, margin: 0, color: 'var(--text)' }}>
        Sheet not found or expired
      </h1>
      <p style={{ color: 'var(--text-3)', fontSize: 15, lineHeight: 1.5, margin: 0 }}>
        This spreadsheet either never existed or has passed its TTL and been deleted.
      </p>
      <p style={{ marginTop: 8 }}>
        <a
          href="/"
          style={{
            display: 'inline-block',
            padding: '10px 22px',
            background: 'var(--green)',
            color: '#fff',
            textDecoration: 'none',
            fontWeight: 500,
            borderRadius: 4,
            boxShadow: 'var(--shadow-1)',
          }}
        >
          Create a new spreadsheet
        </a>
      </p>
    </main>
  );
}
