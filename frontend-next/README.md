# FinanceIQ — Next.js Frontend

This is the new dashboard UI (Next.js 16 + React 19 + Tailwind v4 + shadcn/ui)
wired to the existing FinanceIQ FastAPI backend and Supabase Auth.

## Setup

```bash
cd frontend-next
npm install
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# and NEXT_PUBLIC_API_BASE (default: http://localhost:8000).
```

## Run

In one terminal:

```bash
# Project root — start the FastAPI backend
uvicorn api.main:app --reload --port 8000
```

In another:

```bash
cd frontend-next
npm run dev
```

Open <http://localhost:3000>. You'll be redirected to `/login`. Sign up with
the same email you registered in Supabase — the dashboard then loads your real
holdings, goals, alerts, news, rebalancing recommendations, and chat history.

## How it's wired

- **Auth** – `lib/supabase.ts` + `lib/auth-context.tsx` use the Supabase JS
  SDK. Every request from `lib/api.ts` attaches the current
  `Bearer ${access_token}` so it lands on the FastAPI backend already
  authenticated.
- **API rewrites** – `next.config.mjs` proxies `/api/*` and `/health` to
  `NEXT_PUBLIC_API_BASE`. Same-origin in dev → no CORS dance.
- **Tabs**:
  - Dashboard → `/api/portfolio/summary`, `/api/holdings`, `/api/alerts`,
    `/api/rebalancing/recommendations`
  - Investment → portfolio history, current holdings, live news (`/api/news/recent`)
  - Rebalance → `/api/portfolio/summary` for drift, `/api/rebalancing/...`
  - Activity → `/api/alerts` + `/api/news/recent` merged feed
  - Goals → `/api/goals` with target-allocation strips
  - AI → streaming `/api/chat`, `/api/scenarios/run` for the time machine
- **Sync prices** – buttons in the header + Dashboard call
  `POST /api/holdings/sync-prices` (yfinance under the hood).
- **Pull news** – buttons trigger `POST /api/news/refresh`, which runs one
  ingestion + classifier cycle on demand (works without the always-on worker).

The visual design from the pulled UI (Steady-style tab bar, gradient stat
cards, radial profits chart, AI workspace with sidebar + tool grid + modals)
is preserved 1:1; only the data sources changed.
