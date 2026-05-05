'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSheet } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ttl, setTtl] = useState(14);

  async function onCreate() {
    setLoading(true);
    setError(null);
    try {
      const { id } = await createSheet({ ttlDays: ttl });
      router.push(`/s/${id}`);
    } catch (e: any) {
      setError(e.message ?? 'failed');
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '80px auto', padding: '0 24px' }}>
      <h1 style={{ fontSize: 44, margin: '0 0 12px' }}>OpenSheets</h1>
      <p style={{ fontSize: 18, color: '#444', marginTop: 0 }}>
        Free, open-source, collaborative spreadsheets. No account needed. Sheets auto-delete after their TTL.
      </p>

      <div style={{ marginTop: 32, padding: 24, background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12 }}>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Auto-delete after{' '}
          <select value={ttl} onChange={(e) => setTtl(Number(e.target.value))}>
            <option value={1}>1 day</option>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days (max)</option>
          </select>{' '}
          of inactivity
        </label>
        <button
          onClick={onCreate}
          disabled={loading}
          style={{
            padding: '12px 24px',
            background: '#111',
            color: '#fff',
            border: 0,
            borderRadius: 8,
            fontSize: 16,
          }}
        >
          {loading ? 'Creating…' : 'Create new sheet →'}
        </button>
        {error && <p style={{ color: '#b91c1c' }}>Error: {error}</p>}
      </div>

      <footer style={{ marginTop: 64, color: '#666', fontSize: 14 }}>
        Runs on donations. <a href="https://opencollective.com/">Donate</a> · <a href="https://github.com/">GitHub</a>
      </footer>
    </main>
  );
}
