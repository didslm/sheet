export default function NotFound() {
  return (
    <main style={{ maxWidth: 560, margin: '120px auto', padding: '0 24px', textAlign: 'center' }}>
      <h1>Sheet not found or expired</h1>
      <p style={{ color: '#666' }}>This sheet either never existed or has passed its TTL and been deleted.</p>
      <p><a href="/">← Create a new one</a></p>
    </main>
  );
}
