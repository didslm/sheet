import 'server-only';
import { ensureSchemaReady, sql } from './db';
import type { Sheet } from './api';

export async function loadSheet(id: string): Promise<Sheet | null> {
  await ensureSchemaReady();

  const rows = await sql`
    SELECT id, title, created_at, last_edited_at, expires_at, ttl_days
    FROM sheets
    WHERE id = ${id}
  ` as Sheet[];
  if (rows.length === 0) return null;
  const sheet = rows[0];
  if (new Date(sheet.expires_at).getTime() < Date.now()) return null;
  return sheet;
}
