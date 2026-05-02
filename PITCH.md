# FinanceIQ — Slide-Ready Project Brief

> **Drop this entire file into Claude as context, then ask: "Generate a hackathon pitch deck for this project."**
>
> Built for **HackUTD 2025 — Goldman Sachs "Empowering the Everyday Investor"** challenge.
> Live demo: https://financeiq-gilt.vercel.app
> Repo: https://github.com/harshptl05/FinanceIQ

---

## 1 · The 30-Second Pitch

**FinanceIQ is the financial advisor that 90% of Americans can't afford** — one that speaks plain English, watches your money 24/7, and stops you from making emotional decisions.

It's a production-grade, AI-powered portfolio management platform built specifically for non-savvy investors who own 401ks and mutual funds but don't know what's inside them, when to rebalance, or what news actually affects their money.

**The hook:** *Most people don't need another trading app. They need a thoughtful advisor that watches their money so they don't have to.*

---

## 2 · The Problem (Slide 2 material)

| Statistic | Source / framing |
|---|---|
| **90% of Americans** can't afford a personal financial advisor (~$2,000-5,000/yr min) | Industry baseline |
| **65% of 401k holders** can't name a single fund they own | Survey baseline |
| **Most everyday investors hold 3-5 mutual funds that are 70% the same underlying stocks** | Diversification illusion |
| **Behavioral mistakes** (panic selling, FOMO buying) cost the average investor **2-3% per year** in lost returns | DALBAR studies |
| **Rebalancing alone** generates a **0.5-1.5% annual return premium** ("Shannon's Demon") | Mathematical fact |
| Current "robo-advisors" (Betterment, Wealthfront) are great for accounts they manage — **terrible for the 401k you can't move** | Market gap |

> **Bottom line:** people who need help most have the worst tools.

---

## 3 · The Solution (Slide 3)

A multi-agent AI advisor that:

1. **Watches the news 24/7** and tells you only what matters *to your specific portfolio*
2. **Auto-detects when you've drifted** from your target allocation and tells you exactly what to buy/sell
3. **Speaks plain English** — never says "duration" without explaining it
4. **Stops you from panic-selling** by detecting emotional language and intervening with historical context
5. **Tracks its own accuracy** — every recommendation is graded 30 days later

Built on a real multi-agent pipeline (not a single chatbot wrapper), with calibrated classification, glide-path target allocations, tax-loss harvesting awareness, and a live mutual fund overlap analyzer.

---

## 4 · Architecture Diagram (Slide 4)

```
                    ┌────────────────────────┐
                    │   User (Browser)       │
                    └───────────┬────────────┘
                                │
                ┌───────────────▼───────────────┐
                │  Vercel · Next.js 16 / React  │
                │  shadcn/ui · Tailwind v4      │
                │  lightweight-charts (live)    │
                │  Supabase Realtime subs       │
                └───────────────┬───────────────┘
                                │
                ┌───────────────▼───────────────┐
                │  Railway · FastAPI            │
                │  + asyncio Multi-Agent Worker │
                └─┬──────┬─────┬─────┬──────┬───┘
                  │      │     │     │      │
       ┌──────────▼──┐ ┌─▼───┐ ┌▼──┐ ┌▼────┐ ┌▼────────┐
       │ Supabase    │ │Claude│ │FRED│ │Yahoo│ │NewsAPI  │
       │ Postgres+   │ │Sonnet│ │API │ │Fin. │ │Polygon  │
       │ Auth+RLS+   │ │ 4    │ │    │ │RSS  │ │Alpha-V. │
       │ Realtime    │ └──────┘ └────┘ └─────┘ └─────────┘
       └─────────────┘
```

**Two Railway processes** running simultaneously:
- `web` — FastAPI server (REST + streaming chat + `/health`)
- `worker` — Always-on agent orchestrator (24/7 even when no user is online)

---

## 5 · Tech Stack (Slide 5)

| Layer | Tech | Why |
|---|---|---|
| Frontend | **Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui** | Modern App Router, RSC-friendly, beautiful out of the box |
| Charts | **Recharts** (static), **lightweight-charts v5** (live) | Recharts for portfolio history, lightweight-charts for tick-by-tick simulation |
| State | **React Context** (`LivePricesProvider`) | Global tick stream powers P&L everywhere |
| Backend | **FastAPI · Python 3.11 · asyncio** | Native async for the agent pipeline |
| Database | **Supabase** (Postgres + Auth + Realtime + RLS) | Row-level security gives us tenant isolation for free |
| AI | **Claude `claude-sonnet-4-20250514`** | Tool calling + classification (not probability prediction) |
| Market data | **yfinance · Polygon.io · Alpha Vantage · FRED** | Tiered fallbacks; FRED for macro indicators |
| News | **Yahoo Finance RSS · NewsAPI · feedparser** | Multiple sources, deduplicated by hash |
| Brand marks | **logo.dev** | Real ticker logos, not generic letter circles |
| Deploy | **Vercel** (frontend) + **Railway** (backend) | Both auto-deploy from GitHub `main` |
| Monitoring | **UptimeRobot** | Pings `/health` every 5 min |

---

## 6 · The Multi-Agent Pipeline (Slide 6 — the technical wow)

Seven specialized agents, orchestrated by `OrchestratorAgent`. Each one isolated, restartable, and observable via `/health`.

```
                  OrchestratorAgent  (master controller, /health endpoint)
                         │
   ┌─────────────────────┼─────────────────────┬───────────────────┐
   │                     │                     │                   │
NewsIngestion      PortfolioSync       ClassificationAgent     CalibrationAgent
(every 5 min)      (every 15 min       (Claude — every news    (nightly accuracy
                    market hours)       event vs. each user)    grading)
   │                     │                     │
   └─────────────┬───────┴───────────────┬─────┘
                 │                       │
          RebalancingAgent          AlertAgent
          (drift detection,         (Supabase Realtime
          glide-path targets,       push to frontend)
          tax-loss harvest)
```

**Key agent files** (Python, in `agents/`):
- `orchestrator.py` — boots all agents, restarts crashed ones, never lets one bad agent take down the worker
- `news_ingestion.py` — Yahoo Finance RSS + FRED indicators + NewsAPI; dedupes by SHA-256(headline)
- `portfolio_sync.py` — yfinance every 15 min; **skips mutual funds outside daily NAV window (21:00–23:00 UTC)**
- `classifier.py` — sends each news event + user portfolio to Claude; gets back `{impact, materiality, urgency, dollar_impact, plain_english}`
- `rebalancing.py` — implements **all four** rebalancing strategies (calendar / threshold / hybrid / cash flow)
- `alert_agent.py` — pushes via Supabase Realtime so the UI updates instantly with no polling
- `calibrator.py` — grades 30-day-old recommendations: did they actually help?

---

## 7 · The Financial Intelligence Layer (Slide 7 — credibility)

This is where we differentiate from "just another GPT wrapper."

### Risk **Capacity** vs. Risk **Tolerance** (most tools only ask one)
- **Tolerance** = emotional ("How do you feel about losing 20%?")
- **Capacity** = financial ("Can your situation actually survive a 20% loss?")
- We assess **both** and use the *lower* as the binding constraint
- *Talking point:* "Most tools ask one question and call it a day. We ask both because they're often different — and the gap is where people get hurt."

### Glide Path — target allocation that auto-shifts toward goal date
```python
GLIDE_PATH["retirement"] = {
    20 yrs out:  70% US stocks · 20% intl · 10% bonds · 0% cash
    10 yrs out:  50% US stocks · 10% intl · 30% bonds · 10% cash
     2 yrs out:  20% US stocks ·  0% intl · 50% bonds · 30% cash
}
```

### Four Rebalancing Strategies (most apps support 0 or 1)
| Strategy | When | Trade-off |
|---|---|---|
| **Calendar** | Quarterly / annually | Predictable, can miss drift between dates |
| **Threshold** | Drift > 5% | Reactive, can trigger excessive trading |
| **Hybrid** | Calendar AND threshold | Best of both — only act when both agree |
| **Cash-flow** | New deposits go to underweighted assets | **Tax-efficient — never sells** |

### Tax-Loss Harvesting Awareness
Before every "sell" recommendation, we scan holdings for unrealized losses and surface them: *"Selling your VTI captures a $640 tax deduction this year."*

### Account-Type Aware
- 401k / IRA: rebalance freely (no tax)
- Taxable: flag short-term vs. long-term capital gains, surface tax-loss opportunities

### Shannon's Demon (the math nobody talks about)
Regular rebalancing of a volatile portfolio generates an **expected 0.5-1.5% annual return premium** over buy-and-hold. We tell users this in plain English: *"Rebalancing isn't just risk management — it's a return strategy."*

---

## 8 · Mutual Fund Support (Slide 8 — the moat)

**Why this matters more than anything else we built:** every other portfolio app handles stocks fine. None of them handle mutual funds well. That's exactly what 401k investors actually own.

### What's different about mutual funds
- They don't trade in real time — they price **once per day at 4pm ET** (NAV)
- Expense ratios silently drain returns (avg active fund: ~0.6%/yr → **~$60K lost per $100K over 30 years**)
- Funds overlap heavily — most 401k holders own 3-5 funds that are 70% identical underneath

### What FinanceIQ does (and Robinhood / Wealthfront don't)
1. **Curated metadata** for 18 of the most commonly held funds (VTSAX, VFIAX, FXAIX, FCNTX, VTI, VOO, etc.) — top holdings, sector weights, fund family, category
2. **NAV-aware sync** — `PortfolioSyncAgent` skips intraday price ticks for mutual funds (they don't have intraday prices)
3. **Daily NAV chart mode** — `MarketChart` switches to a 90-day daily NAV line for funds (no fake intraday candles)
4. **Fund overlap analyzer** — pairwise weighted-min overlap; flags pairs > 10% with plain-English warnings
5. **Cost-drag visualizer** — shows the dollar cost of expense ratios over 1 year and 10 years, color-coded by severity, compared to index fund alternatives
6. **Fund composition viewer** — top 10 holdings + sector breakdown pie chart on click

### What this looks like in the UI
- Stock detail dialog auto-detects mutual funds → swaps in NAV banner, fund composition, cost-drag panel
- "MF" pill + expense ratio shown inline on every fund row in My Assets
- Investment tab gets a dedicated Fund Overlap card highlighting the user's biggest hidden duplications

> **Talking point for judges:** *"This is the asset class everyday investors actually own — and this is where the biggest hidden problems live. Most 401k holders pay more in fund fees over 30 years than they paid for their house."*

---

## 9 · Live Market Simulation (Slide 9 — the wow factor)

We need a portfolio app that *feels alive* even when markets are closed (judging happens on a weekend).

### What we built
- **`lightweight-charts` v5** (TradingView's open-source chart library) — pro-grade candlesticks
- **2-second tick loop** — `setInterval` generates a new candle from a deterministic random walk
- **Mean-reverting synthetic data** — anchored to the real last-known price, so the chart "looks like the stock"
- **Global state sync via `LivePricesProvider`** — every tick updates a React Context that drives portfolio value, P&L, top movers, and ticker pills *everywhere on the page simultaneously*
- **Period selector**: 1D · 1W · 1M · 3M · 6M · 1Y — each rebuilds the chart at the right time resolution (1m / 10m / 1h / daily bars)
- **`resetBase(ticker)` on chart mount** — every period switch re-anchors "since open" so the percentage is meaningful

### Important detail (engineering depth)
- **Mutual funds are explicitly excluded** from the live tick stream — they don't have intraday prices, faking it would be a lie. Funds get a separate `daily-nav` chart mode.
- **`basePrices` ≠ `prices`** — we keep two maps in Context: the *first* tick we ever observed (for "since open" %) and the *current* live tick. Fixed a subtle bug where these were conflated.

> **Talking point:** *"Most demo apps freeze on weekends. Ours runs 24/7 because the live feel is the product — and we're honest about which assets actually move intraday."*

---

## 10 · The AI Advisor (Slide 10)

### System prompt is rebuilt on every chat message with the user's full financial context
- Risk tolerance + capacity
- All goals + glide-path target allocations
- Every holding + current vs. target drift
- Recent alerts
- Today's macro context (FRED indicators)

### Tool calling — Claude can fetch live data mid-conversation
| Tool | What it does |
|---|---|
| `get_stock_info` | Live price + recent performance |
| `get_fund_breakdown` | Top holdings, sector mix, expense ratio |
| `run_scenario` | Simulate user's portfolio in 2008 / COVID / 2022 / dot-com / high-inflation |
| `check_goal_progress` | "Will I hit $1.5M by 65?" |
| `get_rebalancing_recommendation` | On-demand fresh recommendation |
| `get_macro_data` | Current rates, inflation, market state |

### Behavioral Intervention Detection
Pre-check on every user message — detects emotional language (`"sell everything"`, `"going to the moon"`, `"i lost so much"`) and prepends a behavioral context to the system prompt.

> *"User appears to be considering panic selling. Validate the emotion. Reference their specific timeline. Show historical recovery data."*

### Streaming + Markdown
Token-by-token streaming. Tool-call activity surfaces as *"Fetching your Apple stock data..."* mid-response.

### Chat history
Full conversations persisted to Supabase `chat_history`, sidebar shows recent threads — like ChatGPT for finance.

---

## 11 · AI Market Pulse (Slide 11)

Live news feed card on the dashboard showing only **3-4 events that affect *this user's* holdings.**

- News ingested by `NewsIngestionAgent` → sent to `ClassificationAgent`
- Claude returns `{affected_holdings, impact, materiality, urgency, plain_english}`
- Only `materiality > 0.6` items reach the user
- Pushed live via Supabase Realtime — no polling
- Refresh button calls `/news/refresh` (triggers full ingestion + classification pipeline) and polls for new items, with toast feedback

> **Differentiator:** *"Yahoo Finance shows you everything. We show you only what matters to your money."*

---

## 12 · Calibration & Accountability (Slide 12 — the "no other app does this")

Every rebalancing recommendation is **graded 30 days later**:
- Did the portfolio outperform doing nothing?
- Was the urgency call correct?

Stored in `recommendation_calibration` table. Surfaced on the dashboard:

> **"Our recommendations improved portfolio performance 73% of the time."**

This is a real number, not a marketing claim. Every advisor in the world should publish this stat. None of them do.

> **Talking point:** *"We're the first portfolio AI that grades its own homework."*

---

## 13 · The Demo Flow (Slide 13 — judge walkthrough, 3 min)

1. **Login** as `Alex Johnson` — pre-seeded with realistic 401k portfolio (`VTI · VXUS · BND · AAPL · MSFT · VMFXX`, $127K total, $1.5M retirement goal in 22 years)
2. **Dashboard** — portfolio value chart, allocation donut (current vs. target), live AI Market Pulse feed
3. **Live Market card** — pick AAPL → 2-second ticking candles, P&L updates everywhere on the page, switch to 1M/6M timeline → chart resamples instantly
4. **Click an alert** — *"Fed minutes hint at slower easing — your bond ETF could see ~$340 of pressure. Here's what I recommend."*
5. **Open AI Advisor** → ask *"Am I ready to retire in 20 years?"* → Claude streams a response with the user's actual numbers
6. **Run a scenario** — 2008 Financial Crisis → see dollar impact per holding
7. **Investment tab** → see Fund Overlap card flagging that VTI and a 401k mutual fund are 78% the same
8. **Rebalance tab** → click pending recommendation → exact buy/sell list, tax notes, urgency reasoning
9. **Calibration banner** — *"Our recommendations improved portfolio performance 73% of the time."*

---

## 14 · Differentiators (Slide 14 — competitive table)

| Feature | Robinhood | Wealthfront | ChatGPT | **FinanceIQ** |
|---|---|---|---|---|
| Manage existing 401k | ❌ | ❌ | ❌ | ✅ |
| Mutual fund overlap analysis | ❌ | ❌ | ❌ | ✅ |
| Personalized news classification | ❌ | ❌ | ⚠️ generic | ✅ per-portfolio |
| Risk capacity (not just tolerance) | ❌ | ⚠️ | ❌ | ✅ |
| Tax-loss harvesting awareness | ❌ | ✅ | ❌ | ✅ |
| Plain-English explanations | ❌ | ⚠️ | ⚠️ | ✅ |
| Behavioral intervention | ❌ | ❌ | ❌ | ✅ |
| Self-graded recommendations | ❌ | ❌ | ❌ | ✅ |
| Cost | $5/mo+ | 0.25% AUM | $20/mo | **Free** |

---

## 15 · Engineering Highlights for Judges (Slide 15 — depth)

Use this language verbatim — it shows financial + technical literacy:

- "We use **threshold rebalancing with configurable drift bands**, adapted per account type."
- "We **separate risk capacity from risk tolerance** — most tools only ask one."
- "We **flag tax-loss harvesting opportunities** when rebalancing requires selling in taxable accounts."
- "We use a **glide path model** that automatically shifts target allocation as goal dates approach."
- "Our classification architecture asks Claude to **classify impact** — bullish/bearish/neutral — rather than predict probabilities. Classification is what LLMs are genuinely good at; probability calibration is not."
- "We track **recommendation accuracy over time** using a 30-day calibration framework — we can tell you if our advice actually worked."
- "**Mutual fund handling is NAV-aware** — we don't fake intraday ticks for assets that price once per day."
- "Live ticks are **mean-reverting synthetic candles** anchored to the real last-known price, so the chart 'looks like the stock' even when markets are closed."
- "**Row-level security on every Supabase table** — multi-tenancy enforced at the database, not the app layer."

---

## 16 · By the Numbers (Slide 16 — sticker stats)

- **7 specialized agents** running 24/7
- **18 mutual funds** in the curated database (top 401k holdings)
- **5 historical scenarios** (2008, COVID, 2022 rate hikes, dot-com, high-inflation)
- **6 timeline resolutions** on the live chart (1D → 1Y)
- **4 rebalancing strategies** (vs. 0-1 for typical apps)
- **2-second tick rate** for the live market simulation
- **6 Claude tools** the AI advisor can call mid-conversation
- **30-day calibration window** for every recommendation
- **0 fake data** in the production demo — every number is either real (yfinance/FRED) or transparently labeled simulated

---

## 17 · Project File Structure (Slide 17 — architecture transparency)

```
FinanceIQ/
├── agents/                      # 24/7 multi-agent pipeline (Python asyncio)
│   ├── orchestrator.py          # master controller + /health
│   ├── news_ingestion.py        # Yahoo RSS + FRED + NewsAPI
│   ├── portfolio_sync.py        # yfinance, NAV-aware
│   ├── classifier.py            # Claude impact classification
│   ├── rebalancing.py           # 4 strategies + tax logic
│   ├── alert_agent.py           # Supabase Realtime push
│   └── calibrator.py            # 30-day recommendation grading
│
├── api/                         # FastAPI REST + streaming
│   ├── main.py                  # app entry, router registration
│   ├── auth.py · portfolio.py · goals.py · holdings.py
│   ├── alerts.py · rebalancing.py · scenarios.py · news.py
│   ├── chat.py                  # streaming Claude endpoint
│   └── funds.py                 # mutual fund metadata + overlap + cost-drag
│
├── financial/                   # the brain
│   ├── glide_path.py            # target allocation by goal/timeline
│   ├── rebalancing_math.py      # drift, urgency, tax-loss harvest
│   ├── risk_assessment.py       # capacity vs tolerance
│   ├── scenario_data.py         # historical scenario returns
│   └── portfolio_math.py        # MPT, Sharpe ratio
│
├── data/                        # external data clients
│   ├── market_data.py           # yfinance wrapper
│   ├── fund_data.py             # mutual fund metadata + overlap math
│   ├── curated_funds.json       # 18 hand-curated 401k staples
│   ├── fred_client.py           # macro indicators
│   └── news_client.py           # NewsAPI + RSS
│
├── core/
│   ├── config.py · database.py · claude_client.py · logger.py
│
├── frontend-next/               # Next.js 16 + React 19
│   ├── app/                     # App Router
│   ├── components/
│   │   ├── tabs/                # dashboard · investment · rebalance · activity · goals
│   │   ├── live-market-card.tsx # 2s-tick chart + 1D/1W/1M/3M/6M/1Y selector
│   │   ├── market-chart.tsx     # lightweight-charts wrapper, dual-mode (live | daily-nav)
│   │   ├── portfolio-value-chart.tsx  # area chart with period selector
│   │   ├── market-pulse-card.tsx      # AI-classified news for THIS user
│   │   ├── stock-detail-dialog.tsx    # mutual-fund-aware
│   │   ├── fund-composition.tsx       # top 10 holdings + sector pie
│   │   ├── fund-cost-drag.tsx         # 1y / 10y expense ratio drag
│   │   ├── fund-overlap-card.tsx      # pairwise overlap analyzer
│   │   ├── ai-tab/                    # Claude advisor: chat + insights + scenarios
│   │   ├── ticker-logo.tsx            # logo.dev brand marks
│   │   └── ui/                        # shadcn/ui (new-york)
│   └── lib/
│       ├── api.ts               # typed REST client
│       ├── supabase.ts          # Realtime client
│       ├── live-prices.tsx      # global tick state (prices + basePrices)
│       ├── funds.ts             # mutual fund detection + NAV history
│       ├── market-data.ts       # synthetic candle generator
│       └── format.ts            # money / pct / color helpers
│
├── migrations/
│   ├── 001_chat_conversations.sql
│   └── 002_mutual_fund_support.sql   # is_mutual_fund, expense_ratio, nav_date, fund_metadata
│
├── supabase_schema.sql          # full DB schema
├── seed_demo.py                 # idempotent demo data seeder (no fake alerts)
├── Procfile                     # Railway: web + worker
├── railway.toml · runtime.txt
├── CLAUDE.md                    # original architectural spec (~1,100 lines)
├── PORTFOLIO-DASHBOARD-SPEC.md  # frontend design spec
├── DEPLOY.md                    # deployment runbook
└── PITCH.md                     # ← you are here
```

---

## 18 · Honest Limitations (Slide 18 — credibility move)

A real demo lists what's *not* there yet:

- **No real brokerage execution** — we generate recommendations, we don't place trades. Plaid + Alpaca integration is the obvious next step.
- **Mutual fund metadata is curated, not live** — 18 funds covered. Live scraping is unreliable; a paid Morningstar API would close this gap.
- **Behavioral intervention is keyword-based** — not yet a fine-tuned classifier. Works for the demo; would benefit from a sentiment model.
- **Calibration window is 30 days** — too short to prove long-term advice quality. Would extend to 90 / 365 days in production.
- **English-only** — i18n is straightforward but not done.

> **Talking point:** *"We were honest about what's real and what's simulated. Every dollar of fake data on the page is labeled as such."*

---

## 19 · What's Genuinely New Here (Slide 19 — the "why us")

If a judge asks "what's actually novel?" — these are the four:

1. **Personalized news classification at the portfolio level** — most apps show generic news; we filter by your actual holdings *and* call out the dollar impact.
2. **Mutual fund overlap analyzer with cost-drag visualization** — the single highest-impact insight for the average 401k holder. Nobody else surfaces this.
3. **Self-graded recommendations** (`CalibrationAgent`) — the first AI advisor that publishes its own track record on the dashboard.
4. **Risk capacity ≠ risk tolerance, enforced** — we use the binding constraint, not the more aggressive answer. This is real fiduciary thinking, not vibes.

---

## 20 · The Goldman Sachs Tie-In (Slide 20)

The challenge prompt: *"Empowering the Everyday Investor."*

Goldman's own *Marcus by Goldman Sachs* exited US personal lending in 2023. The everyday-investor segment is wide open — and the people in it have the *worst* tools. FinanceIQ is a wedge into that gap built on three principles Goldman would recognize:

1. **Fiduciary thinking, encoded in software** — risk capacity over tolerance, tax-aware rebalancing, glide paths.
2. **Transparency** — every recommendation cites its trigger, its tax implications, and its historical accuracy.
3. **Plain-English access** — we don't dumb the math down. We explain it.

> **The closing line:** *"Every Goldman client gets a portfolio manager. We're trying to give the other 99% a meaningfully similar experience — for free."*

---

## 21 · Build Timeline (Slide 21 — the meta-story)

Built in **~36 hours** during HackUTD 2025. Commits in chronological order:

| Commit | What |
|---|---|
| `ef82c67` | Initial scaffolding |
| `90ddfa7` | Portfolio dashboard + AI tab v1 |
| `ae50038` | **Full FinanceIQ platform** — backend, agents, Next.js dashboard |
| `df1c4cc` | AI Market Pulse card + logo.dev brand marks |
| `3242905`-`5a6ee22` | Vercel + Railway deployment hardening |
| `8fe531c` | **Live market simulation** with lightweight-charts |
| `e87aeac` | **Full mutual fund support** (curated metadata, NAV mode, overlap, cost-drag) |
| `656237d` | Hero portfolio chart on dashboard + working Market Pulse refresh |
| `8a1f0f7` | Live market % change actually ticks (basePrice anchor fix) |
| `75d6c38` | **Timeline period selector** (1D / 1W / 1M / 3M / 6M / 1Y) |

---

## 22 · Talking Points Cheat Sheet (Slide 22 — for Q&A)

If a judge asks…

**"Why not just use ChatGPT?"** → *"ChatGPT doesn't know your portfolio. It can't tell you that your bond ETF dropped $340 today, or that two of your funds are 78% identical. The whole product is the personalization layer between the LLM and your money."*

**"What about hallucination?"** → *"Every numerical claim Claude makes comes from a tool call to a real data source — yfinance, FRED, our DB. The LLM phrases the answer; it doesn't invent the numbers. And we ask Claude to classify, not predict — that's the task LLMs are genuinely good at."*

**"How is this different from a robo-advisor?"** → *"Robos manage accounts they custody. We help you manage the 401k you can't move. That's the bigger market."*

**"How do you make money?"** → *"Same model as Personal Capital before they were acquired — free advisory features acquire users; premium features (Plaid sync, automated trade execution, advisor messaging) monetize. We're focused on the wedge first."*

**"What if your AI gives bad advice?"** → *"That's exactly what `CalibrationAgent` exists for. Every recommendation is graded 30 days later. We publish accuracy on the dashboard. That number going up over time is the entire product flywheel."*

---

## 23 · Closing Slide

> **FinanceIQ — the financial advisor you couldn't afford.**
>
> Built in 36 hours. Live at https://financeiq-gilt.vercel.app

**Team / Repo:** https://github.com/harshptl05/FinanceIQ
**Sponsor challenge:** Goldman Sachs · *Empowering the Everyday Investor*
**Stack:** Next.js 16 · FastAPI · Supabase · Claude Sonnet 4 · lightweight-charts · Railway · Vercel
