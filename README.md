# OrgOS

Independent Next.js app for OrgOS workflows.

## Run locally

```bash
cd /Users/globetrotter/Documents/Codex/OrgDryft
npm install
npm run dev
```

Open: `http://localhost:3000`

To run the production server locally:

```bash
npm run build
npm run start
```

## Environment

Create `.env` from the example file:

```bash
cp .env.example .env
```

Then set:

```bash
MAKE_WEBHOOK_URL=https://your-orgos-webhook-url
```

If `MAKE_WEBHOOK_URL` is blank, the app falls back to local mock data.

## Included

- Ask OrgOS chat surface
- `POST /api/orgos` webhook route
- OrgOS role map visual
- OrgOS career pathway visual
- Local mock fallback data
