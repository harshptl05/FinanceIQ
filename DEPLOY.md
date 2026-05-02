# FinanceIQ — Deployment

Two services:

| Service             | Where     | What it runs                                     |
|---------------------|-----------|--------------------------------------------------|
| Frontend (Next.js)  | Vercel    | `frontend-next/` — deployed via `vercel.json`    |
| Backend API         | Railway   | `uvicorn api.main:app` (defined in `railway.toml`) |
| Backend worker      | Railway   | `python -m agents.orchestrator` (Procfile)       |

The frontend talks to the backend via `NEXT_PUBLIC_API_BASE` (rewrites
in `frontend-next/next.config.mjs` proxy `/api/:path*` to that origin).

---

## 1. Backend on Railway

### Easiest: GitHub auto-deploy (no CLI required)

1. Go to https://railway.app/new → **Deploy from GitHub repo**.
2. Pick `harshptl05/FinanceIQ`.
3. Railway will detect `railway.toml` and start building. The first
   service is the **API** (`uvicorn api.main:app`).
4. Once the build finishes, click the service → **Settings → Networking
   → Generate Domain**. You'll get `https://financeiq-production-xxxx.up.railway.app`.
5. Click **Variables** and paste every line from your local `.env`
   (Anthropic, Supabase, Alpha Vantage, FRED, NewsAPI, Polygon, etc.).
6. (Optional but recommended) Add a second service for the agent
   orchestrator: project → **+ New → Empty Service** → set
   **Start Command** to `python -m agents.orchestrator` and **Source**
   to the same GitHub repo. Re-paste the same env vars.

### Alt: CLI

```bash
brew install railway     # or:  npm i -g @railway/cli
railway login
railway init             # creates project from this repo
railway up               # deploys
railway domain           # generates a public URL
railway variables --set KEY=VALUE   # repeat for each env var in .env
```

---

## 2. Frontend on Vercel

`vercel.json` at the repo root tells Vercel to build `frontend-next/`.
After import, set these **Production** env vars in
**Project Settings → Environment Variables**:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from `.env` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from `.env` |
| `NEXT_PUBLIC_LOGO_DEV_KEY` | `pk_UjXRtEWXRDSBFeKGb5mbfg` |
| `NEXT_PUBLIC_API_BASE` | the Railway URL from step 1, e.g. `https://financeiq-production-xxxx.up.railway.app` |

Then **Deployments → … → Redeploy** (uncheck "Use existing build cache").

---

## 3. Verify

```bash
curl https://<railway-url>/health
# {"status":"alive","agents":{...}}

curl https://<vercel-url>/api/news/pulse
# 401 Missing token (expected — endpoint requires auth)
```
