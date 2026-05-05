export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4001';

export interface Sheet {
  id: string;
  title: string;
  created_at: string;
  last_edited_at: string;
  expires_at: string;
  ttl_days: number;
  size_bytes: number;
}

export async function createSheet(opts: { ttlDays?: number; title?: string } = {}) {
  const res = await fetch(`${API_URL}/api/sheets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw new Error(`create_failed_${res.status}`);
  return res.json() as Promise<{ id: string; viewToken: string; ttlDays: number; title: string }>;
}

export async function getSheet(id: string): Promise<Sheet | null> {
  const res = await fetch(`${API_URL}/api/sheets/${id}`, { cache: 'no-store' });
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`fetch_failed_${res.status}`);
  return res.json();
}
