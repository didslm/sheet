import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  // We throw lazily so build-time env-less analysis doesn't crash.
  console.warn('[db] DATABASE_URL is not set');
}

export const sql = neon(url ?? 'postgres://invalid');

export async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS sheets (
      id             TEXT PRIMARY KEY,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_edited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at     TIMESTAMPTZ NOT NULL,
      ttl_days       INT NOT NULL,
      view_token     TEXT NOT NULL,
      title          TEXT NOT NULL DEFAULT 'Untitled sheet'
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS sheets_expires_at_idx ON sheets(expires_at)`;
  await sql`
    CREATE TABLE IF NOT EXISTS create_log (
      ip         TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS create_log_ip_time_idx ON create_log(ip, created_at)`;
}
