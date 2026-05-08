import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { sql, ensureSchemaReady } from '@/lib/db';
import { config } from '@/lib/config';

export const runtime = 'nodejs';

function parseTtlDays(input: unknown) {
  if (input == null) return config.defaultTtlDays;
  if (typeof input !== 'number' || !Number.isFinite(input)) return null;
  return Math.min(Math.max(1, Math.trunc(input)), config.maxTtlDays);
}

function parseCreateTitle(input: unknown) {
  if (input == null) return 'Untitled sheet';
  if (typeof input !== 'string') return null;

  const title = input.trim().slice(0, 200);
  return title || 'Untitled sheet';
}

export async function POST(req: NextRequest) {
  await ensureSchemaReady();

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  const [{ count }] = (await sql`
    SELECT COUNT(*)::int AS count FROM create_log
    WHERE ip = ${ip} AND created_at > now() - interval '1 day'
  `) as { count: number }[];
  if (count >= config.rateLimitCreatePerDay) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { ttlDays?: number; title?: string };
  const ttlDays = parseTtlDays(body.ttlDays);
  const title = parseCreateTitle(body.title);

  if (ttlDays == null) {
    return NextResponse.json({ error: 'invalid_ttl_days' }, { status: 400 });
  }

  if (title == null) {
    return NextResponse.json({ error: 'invalid_title' }, { status: 400 });
  }

  const id = nanoid(12);
  const viewToken = nanoid(16);

  await sql`
    INSERT INTO sheets (id, ttl_days, expires_at, view_token, title)
    VALUES (${id}, ${ttlDays}, now() + (${ttlDays}::int || ' days')::interval, ${viewToken}, ${title})
  `;
  await sql`INSERT INTO create_log (ip) VALUES (${ip})`;

  return NextResponse.json({ id, viewToken, ttlDays, title });
}
