# OpenSheets

Free, open-source, donation-funded collaborative spreadsheets. Create a sheet with one click, share the link, collaborate in real time. Sheets auto-expire after 7–30 days.

> Status: scaffold / MVP in progress. Not production-ready.

## Why
Google Sheets is great but requires a Google account and isn't open. OpenSheets is for quick, ephemeral, no-signup collaboration — funded entirely by donations.

## Architecture
```
apps/
  web/     Next.js 15 + Univer (spreadsheet UI)
  server/  Fastify REST + y-websocket (Yjs CRDT realtime)
scripts/
  expire.ts  Cron job that purges expired sheets
```

| Concern         | Choice                              |
|-----------------|-------------------------------------|
| Spreadsheet UI  | [Univer](https://github.com/dream-num/univer) (Apache-2.0) |
| Realtime        | Yjs + y-websocket (self-hosted)     |
| Metadata DB     | Postgres                            |
| Doc storage     | Filesystem (dev) / S3 or R2 (prod)  |
| Hosting target  | Railway or Fly.io + Cloudflare R2   |
| Donations       | Open Collective / Stripe link       |

## Data model
- `sheets(id, created_at, last_edited_at, expires_at, ttl_days, view_token, size_bytes)`
- Yjs binary doc snapshot per sheet, stored by `id`.

## URLs
- `/`              landing + "New sheet" button
- `/s/:id`         editor (anyone with link can edit)
- `/s/:id/view`    read-only (uses view_token)

## Abuse guardrails
- 10 sheet creations / IP / day
- 100k cell cap, 5 MB doc cap
- Cloudflare in front in production
- No file uploads in v1

## Local dev
```bash
# 1. Postgres
docker compose up -d
# 2. Install
npm install
# 3. Run server (Fastify + WS) and web in two terminals
npm run dev --workspace apps/server
npm run dev --workspace apps/web
```

Open http://localhost:3000

## Deploy
See `DEPLOY.md` (TODO). Targets: Railway for app + managed Postgres, Cloudflare R2 for doc blobs.

## Roadmap
- [x] Repo scaffold
- [ ] Sheet create/load/persist via Yjs
- [ ] Univer ⇄ Yjs binding (cell-level CRDT)
- [ ] Read-only view tokens
- [ ] Expiry cron + UI countdown
- [ ] CSV import/export
- [ ] Donation banner + Open Collective integration
- [ ] Rate limiting + abuse caps
- [ ] R2 blob storage adapter
- [ ] Presence cursors + user colors

## License
MIT
