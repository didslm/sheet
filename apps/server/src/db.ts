import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sheets (
      id            TEXT PRIMARY KEY,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_edited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at    TIMESTAMPTZ NOT NULL,
      ttl_days      INT NOT NULL,
      view_token    TEXT NOT NULL,
      size_bytes    BIGINT NOT NULL DEFAULT 0,
      title         TEXT NOT NULL DEFAULT 'Untitled sheet'
    );
    CREATE INDEX IF NOT EXISTS sheets_expires_at_idx ON sheets(expires_at);

    CREATE TABLE IF NOT EXISTS create_log (
      ip         TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS create_log_ip_time_idx ON create_log(ip, created_at);
  `);
}
