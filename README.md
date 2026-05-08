# OpenSheets

Free, open-source, donation-funded collaborative spreadsheets. Create a sheet with one click, share the link, collaborate in real time. Sheets auto-expire after the lifetime you choose.

> Status: early MVP. Core Univer + Yjs collaboration is wired up, with some structural collaboration limits still being hardened.

## Architecture (free-tier ready)
```
Browser ──HTTPS──▶ Vercel (Next.js + API routes)
   │
   └──WSS──────▶ PartyKit (y-partykit, Durable Object storage)
                       │
Vercel API ─SQL─▶ Neon Postgres (sheet metadata)
```

| Layer | Service | Free tier |
|---|---|---|
| Frontend + REST | Vercel (Next.js 14) | Hobby (non-commercial) |
| Realtime + doc storage | PartyKit (`y-partykit`) | Free in beta |
| Metadata DB | Neon Postgres | 500 MB |
| Cron (expiry) | Vercel Cron | 1 daily job |

See **[DEPLOY.md](./DEPLOY.md)** for step-by-step deploy.

## URLs
- `/`              landing + "New sheet"
- `/s/:id`         editor (anyone with link can edit)
- `/api/sheets`    POST create, GET `/api/sheets/:id` for metadata

## Local dev
```bash
cp .env.example .env.local   # fill DATABASE_URL with a Neon URL
npm install
npm run dev:party            # PartyKit on :1999
npm run dev                  # Next.js on :3001
npm run typecheck
```

## Roadmap
- [x] Repo scaffold + Vercel/PartyKit/Neon wiring
- [x] Univer ⇄ Yjs cell-level binding
- [ ] Collaborative sync for structural sheet changes (row/column sizing, conditional formatting, workbook-level state)
- [ ] Read-only view tokens
- [ ] CSV import/export
- [ ] Donation banner
- [ ] Presence cursors

## License
MIT
