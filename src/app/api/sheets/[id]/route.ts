import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const rows = (await sql`
    SELECT id, title, created_at, last_edited_at, expires_at, ttl_days
    FROM sheets WHERE id = ${params.id}
  `) as any[];
  if (rows.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (new Date(rows[0].expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }
  return NextResponse.json(rows[0]);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = (await req.json().catch(() => ({}))) as { title?: string };
  const title = body.title?.trim().slice(0, 200);

  if (!title) {
    return NextResponse.json({ error: 'invalid_title' }, { status: 400 });
  }

  const rows = (await sql`
    UPDATE sheets
    SET title = ${title},
        last_edited_at = now()
    WHERE id = ${params.id}
    RETURNING id, title, created_at, last_edited_at, expires_at, ttl_days
  `) as any[];

  if (rows.length === 0) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ title: rows[0].title });
}
