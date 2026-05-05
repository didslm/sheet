import { pool } from './db.js';
import { docStore } from './storage.js';

async function main() {
  const { rows } = await pool.query(`SELECT id FROM sheets WHERE expires_at < now()`);
  console.log(`[expire] purging ${rows.length} sheets`);
  for (const { id } of rows) {
    await docStore.remove(id);
    await pool.query('DELETE FROM sheets WHERE id = $1', [id]);
  }
  await pool.query(`DELETE FROM create_log WHERE created_at < now() - interval '7 days'`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
