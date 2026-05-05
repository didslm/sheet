# Deploying OpenSheets (free tier)

Three free services, ~10 minutes:

1. **Neon** — Postgres (sheet metadata)
2. **PartyKit** — Yjs WebSocket + doc storage
3. **Vercel** — Next.js frontend + API routes + cron

---

## 1. Neon (Postgres)

1. Create an account at https://neon.tech (free tier).
2. Create a project → copy the **pooled** connection string (looks like `postgres://...-pooler...neon.tech/...?sslmode=require`).
3. Save it — you'll paste it into Vercel.

The schema auto-creates on the first API call.

## 2. PartyKit (realtime + doc storage)

```bash
npm install
npx partykit login          # one-time
npx partykit deploy         # deploys party/index.ts
```

This prints your party URL: `opensheets.<your-handle>.partykit.dev`. Save it.

Set the admin token used by Vercel's cron to wipe expired docs:

```bash
npx partykit secret put ADMIN_TOKEN     # paste a random string
```

Save the same string for Vercel below.

## 3. Vercel (web + API)

1. Push this repo to GitHub.
2. https://vercel.com → "Add New Project" → import the repo.
3. Add these **Environment Variables** in the Vercel project settings:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Neon pooled URL |
   | `NEXT_PUBLIC_PARTY_HOST` | `opensheets.<your-handle>.partykit.dev` |
   | `ADMIN_TOKEN` | same string you set in PartyKit |
   | `CRON_SECRET` | another random string |

4. Deploy. Done — visit the Vercel URL.

The `vercel.json` cron entry purges expired sheets daily at 04:00 UTC.

---

## Local development

```bash
cp .env.example .env.local
# Fill DATABASE_URL with a Neon dev branch URL (or run a local Postgres if you prefer)

npm install
npm run dev:party    # terminal 1 — PartyKit on :1999
npm run dev          # terminal 2 — Next.js on :3001
```

Open http://localhost:3001.

---

## Costs / limits to watch

| Service | Free limit | What breaks first |
|---|---|---|
| Vercel Hobby | 100 GB bandwidth/mo, 100 hr function exec | Bandwidth if you go viral |
| Neon free | 500 MB storage, auto-suspend after 5 min idle | Storage if many sheets accumulate (cron purges, but deleted rows take vacuum) |
| PartyKit beta | Currently free, unmetered | Will be priced post-beta — escape hatch is self-hosted `y-websocket` on Fly.io |

Vercel Hobby is non-commercial use only. Donations are fine; if you ever sell anything, upgrade to Pro.
