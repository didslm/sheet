export const PARTY_HOST = process.env.NEXT_PUBLIC_PARTY_HOST ?? 'localhost:1999';

export interface Sheet {
  id: string;
  title: string;
  created_at: string;
  last_edited_at: string;
  expires_at: string;
  ttl_days: number;
}

export async function createSheet(opts: { ttlDays?: number; title?: string } = {}) {
  const res = await fetch('/api/sheets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw new Error(`create_failed_${res.status}`);
  return res.json() as Promise<{ id: string; viewToken: string; ttlDays: number; title: string }>;
}

// Server-side fetch (used by RSC). Pass an absolute base URL when called from the server.
export async function getSheet(id: string, baseUrl?: string): Promise<Sheet | null> {
  const url = baseUrl ? `${baseUrl}/api/sheets/${id}` : `/api/sheets/${id}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`fetch_failed_${res.status}`);
  return res.json();
}
