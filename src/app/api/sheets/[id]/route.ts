import { NextRequest, NextResponse } from 'next/server';
import { ensureSchemaReady, sql } from '@/lib/db';
import type { Sheet } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  await ensureSchemaReady();

  const rows = (await sql`
    SELECT id, title, created_at, last_edited_at, expires_at, ttl_days
    FROM sheets WHERE id = ${params.id}
  `) as Sheet[];
  if (rows.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (new Date(rows[0].expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }
  return NextResponse.json(rows[0]);
}

function parseTitle(input: unknown) {
  if (typeof input !== 'string') return null;

  const title = input.trim().slice(0, 200);
  return title || null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await ensureSchemaReady();

  const body = (await req.json().catch(() => ({}))) as { title?: string };
  const title = parseTitle(body.title);

  if (!title) {
    return NextResponse.json({ error: 'invalid_title' }, { status: 400 });
  }

  const rows = (await sql`
    UPDATE sheets
    SET title = ${title},
        last_edited_at = now()
    WHERE id = ${params.id}
      AND expires_at >= now()
    RETURNING id, title, created_at, last_edited_at, expires_at, ttl_days
  `) as Sheet[];

  if (rows.length === 0) {
    const existingRows = (await sql`
      SELECT expires_at FROM sheets WHERE id = ${params.id}
    `) as Array<Pick<Sheet, 'expires_at'>>;

    if (existingRows.length === 0) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    if (new Date(existingRows[0].expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'expired' }, { status: 410 });
    }

    return NextResponse.json({ error: 'update_failed' }, { status: 409 });
  }

  return NextResponse.json({ title: rows[0].title });
}
