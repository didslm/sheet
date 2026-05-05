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
