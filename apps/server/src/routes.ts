import { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { pool } from './db.js';
import { config } from './config.js';
import { docStore } from './storage.js';

export async function registerRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ ok: true }));

  app.post('/api/sheets', async (req, reply) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;

    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM create_log WHERE ip = $1 AND created_at > now() - interval '1 day'`,
      [ip]
    );
    if (count >= config.rateLimitCreatePerDay) {
      return reply.code(429).send({ error: 'rate_limited', message: 'Daily sheet creation limit reached' });
    }

    const body = (req.body ?? {}) as { ttlDays?: number; title?: string };
    const ttlDays = Math.min(Math.max(1, body.ttlDays ?? config.defaultTtlDays), config.maxTtlDays);
    const title = (body.title ?? 'Untitled sheet').slice(0, 200);

    const id = nanoid(12);
    const viewToken = nanoid(16);

    await pool.query(
      `INSERT INTO sheets (id, ttl_days, expires_at, view_token, title)
       VALUES ($1, $2, now() + ($2 || ' days')::interval, $3, $4)`,
      [id, ttlDays, viewToken, title]
    );
    await pool.query('INSERT INTO create_log (ip) VALUES ($1)', [ip]);

    return { id, viewToken, ttlDays, title };
  });

  app.get('/api/sheets/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { rows } = await pool.query(
      `SELECT id, created_at, last_edited_at, expires_at, ttl_days, title, size_bytes
       FROM sheets WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return reply.code(404).send({ error: 'not_found' });
    const sheet = rows[0];
    if (new Date(sheet.expires_at).getTime() < Date.now()) {
      return reply.code(410).send({ error: 'expired' });
    }
    return sheet;
  });

  app.delete('/api/sheets/:id', async (req, reply) => {
    // Self-destruct using the view_token as a weak owner secret (returned at creation).
    const { id } = req.params as { id: string };
    const { token } = (req.query ?? {}) as { token?: string };
    const { rows } = await pool.query('SELECT view_token FROM sheets WHERE id = $1', [id]);
    if (rows.length === 0) return reply.code(404).send({ error: 'not_found' });
    if (rows[0].view_token !== token) return reply.code(403).send({ error: 'forbidden' });
    await pool.query('DELETE FROM sheets WHERE id = $1', [id]);
    await docStore.remove(id);
    return { ok: true };
  });
}
