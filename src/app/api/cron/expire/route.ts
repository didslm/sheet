import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { config } from '@/lib/config';

export const runtime = 'nodejs';

// Vercel Cron hits this. Vercel sets the `Authorization: Bearer <CRON_SECRET>`
// header automatically when CRON_SECRET env var is set.
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const expired = (await sql`
    SELECT id FROM sheets WHERE expires_at < now()
  `) as { id: string }[];

  for (const { id } of expired) {
    if (config.adminToken) {
      // Tell PartyKit to wipe the doc's storage. Best-effort — don't block on failure.
      await fetch(`https://${config.partyHost}/parties/main/${id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${config.adminToken}` },
      }).catch(() => {});
    }
    await sql`DELETE FROM sheets WHERE id = ${id}`;
  }
  await sql`DELETE FROM create_log WHERE created_at < now() - interval '7 days'`;

  return NextResponse.json({ purged: expired.length });
}
