import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { sql, ensureSchema } from '@/lib/db';
import { config } from '@/lib/config';

export const runtime = 'nodejs';

let schemaReady: Promise<void> | null = null;
function readySchema() {
  if (!schemaReady) schemaReady = ensureSchema();
  return schemaReady;
}

export async function POST(req: NextRequest) {
  await readySchema();

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  const [{ count }] = (await sql`
    SELECT COUNT(*)::int AS count FROM create_log
    WHERE ip = ${ip} AND created_at > now() - interval '1 day'
  `) as { count: number }[];
  if (count >= config.rateLimitCreatePerDay) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { ttlDays?: number; title?: string };
  const ttlDays = Math.min(Math.max(1, body.ttlDays ?? config.defaultTtlDays), config.maxTtlDays);
  const title = (body.title ?? 'Untitled sheet').slice(0, 200);

  const id = nanoid(12);
  const viewToken = nanoid(16);

  await sql`
    INSERT INTO sheets (id, ttl_days, expires_at, view_token, title)
    VALUES (${id}, ${ttlDays}, now() + (${ttlDays}::int || ' days')::interval, ${viewToken}, ${title})
  `;
  await sql`INSERT INTO create_log (ip) VALUES (${ip})`;

  return NextResponse.json({ id, viewToken, ttlDays, title });
}
