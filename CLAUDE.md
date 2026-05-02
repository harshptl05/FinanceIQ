# CLAUDE.md — Everyday Investor AI Platform
## HackUTD 2025 — Goldman Sachs Challenge

---

## PROJECT OVERVIEW

Build a production-grade, AI-powered portfolio management platform for everyday (non-market-savvy) investors. The platform must demystify wealth management, allow users to track investments, understand risk exposure, and seamlessly rebalance portfolios in response to changing personal needs or uncertain macroeconomic scenarios.

**Hackathon Prompt:** "Empowering the Everyday Investor"
**Sponsor:** Goldman Sachs
**Target User:** Non-technical individuals with 401ks, mutual funds, ETFs — people who don't understand markets but need to manage their money.

**Core Pitch:** "We built the financial advisor that 90% of Americans can't afford — one that speaks plain English, watches your money 24/7, and stops you from making emotional decisions."

---

## REFERENCE REPOSITORY

Base architecture adapted from: https://github.com/brodyautomates/polymarket-pipeline

Pull and adapt these files (do NOT copy blindly — adapt each one):
- `pipeline.py` → Core asyncio event-driven orchestrator (your backbone)
- `classifier.py` → Claude classification logic (swap market prompts for portfolio impact prompts)
- `matcher.py` → Matching logic (swap prediction markets for user holdings)
- `news_stream.py` → News ingestion (swap Polymarket sources for financial feeds)
- `calibrator.py` → Accuracy tracking (use nearly as-is)
- `backtest.py` → Historical replay (adapt for portfolio scenarios)
- `edge.py` → Signal detection (adapt for rebalancing signals)
- `logger.py` → Logging structure (replace SQLite with Supabase but keep structure)
- `config.py` → Settings pattern (reuse structure)
- `dashboard.py` → Data refresh patterns (rebuild UI in React but keep refresh logic)

Do NOT use from that repo:
- `executor.py` (Polymarket trading — irrelevant)
- `markets.py` (Polymarket data — irrelevant)
- `scraper.py` (Polymarket scraper — irrelevant)
- `cli.py` (CLI interface — you're building React UI)

---

## FULL TECH STACK

### Frontend
- **React** with functional components and hooks
- **Tailwind CSS** for styling
- **Recharts** for portfolio charts and visualizations
- **WebSockets** for real-time portfolio value updates
- **Streaming text** for AI chat responses (typewriter effect like ChatGPT)
- Deployed on **Vercel** (connect to GitHub, auto-deploys on push)

### Backend
- **FastAPI** (Python) for all API endpoints
- **asyncio** for the event-driven multi-agent pipeline
- **APScheduler** for cron jobs (scheduled data refreshes)
- Deployed on **Railway** (always-on worker + web process)

### Database & Auth
- **Supabase** for everything storage-related:
  - PostgreSQL database
  - Built-in Auth (email/password + OAuth)
  - Real-time subscriptions for live portfolio updates
  - Row-level security for user data isolation

### AI
- **Claude API** (claude-sonnet-4-20250514) for:
  - Portfolio impact classification
  - Plain English explanations
  - Conversational advisor chat
  - Tool calling for live data fetching
  - Behavioral intervention responses

### Market Data (all free tier)
- **yfinance** (Python library) — stock/ETF prices, historical data
- **Alpha Vantage API** — mutual fund data
- **FRED API** (Federal Reserve) — macro indicators (inflation, interest rates, GDP)
- **NewsAPI** — financial news headlines
- **Polygon.io** (free tier) — additional market data

### Monitoring
- **UptimeRobot** (free) — pings `/health` endpoint every 5 minutes, alerts if agents go down

### Dev
- **GitHub** — single repo, both Railway and Vercel connect to it and auto-deploy on push
- All secrets in `.env` file, never committed

---

## INFRASTRUCTURE ARCHITECTURE

```
User (Browser)
      ↓
Vercel (React Frontend)
      ↓
Railway (FastAPI Backend + Multi-Agent Pipeline)
      ↓ ↓ ↓
Supabase    Claude API    Data Sources
(DB/Auth)   (AI Brain)    (yfinance/FRED/NewsAPI/AlphaVantage)
```

### Railway Procfile
```
worker: python orchestrator.py
web: uvicorn api:app --host 0.0.0.0 --port $PORT
```

Two Railway processes:
- `worker` = 24/7 agent pipeline (always running)
- `web` = FastAPI server (handles API calls + WebSocket + health check)

### Environment Variables (set in Railway AND locally in .env)
```
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
ALPHA_VANTAGE_API_KEY=
FRED_API_KEY=
NEWS_API_KEY=
POLYGON_API_KEY=
```

---

## SUPABASE DATABASE SCHEMA

Create these tables exactly:

```sql
-- Users extended profile (Supabase Auth handles the base user)
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  full_name TEXT,
  risk_tolerance TEXT CHECK (risk_tolerance IN ('conservative', 'moderate', 'aggressive')),
  risk_capacity TEXT CHECK (risk_capacity IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial goals
CREATE TABLE goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  goal_type TEXT CHECK (goal_type IN ('retirement', 'house', 'college', 'emergency', 'other')),
  goal_name TEXT NOT NULL,
  target_date DATE NOT NULL,
  target_amount DECIMAL(12,2),
  current_amount DECIMAL(12,2) DEFAULT 0,
  target_allocation JSONB, -- {"stocks": 0.6, "bonds": 0.3, "cash": 0.1}
  rebalancing_strategy TEXT CHECK (rebalancing_strategy IN ('calendar', 'threshold', 'hybrid', 'cashflow')),
  rebalancing_threshold DECIMAL(4,2) DEFAULT 0.05, -- 5% default band
  rebalancing_frequency TEXT DEFAULT 'quarterly',
  account_type TEXT CHECK (account_type IN ('401k', 'ira', 'roth_ira', 'taxable', 'other')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Holdings
CREATE TABLE holdings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  goal_id UUID REFERENCES goals,
  ticker TEXT NOT NULL,
  name TEXT,
  asset_class TEXT CHECK (asset_class IN ('us_stocks', 'intl_stocks', 'bonds', 'cash', 'real_estate', 'commodities', 'other')),
  shares DECIMAL(12,4),
  avg_cost_basis DECIMAL(12,4),
  current_price DECIMAL(12,4),
  current_value DECIMAL(12,2),
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Portfolio snapshots (daily)
CREATE TABLE portfolio_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  total_value DECIMAL(12,2),
  allocation JSONB,
  snapshot_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI chat history
CREATE TABLE chat_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  role TEXT CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rebalancing recommendations
CREATE TABLE rebalancing_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  goal_id UUID REFERENCES goals,
  trigger_type TEXT CHECK (trigger_type IN ('drift', 'news_event', 'goal_timeline', 'scheduled')),
  trigger_description TEXT,
  current_allocation JSONB,
  target_allocation JSONB,
  recommended_trades JSONB, -- [{"ticker": "BND", "action": "buy", "amount": 500, "reason": "..."}]
  urgency TEXT CHECK (urgency IN ('act_now', 'act_soon', 'monitor')),
  plain_english_explanation TEXT,
  tax_loss_harvesting_opportunity BOOLEAN DEFAULT FALSE,
  tax_notes TEXT,
  status TEXT CHECK (status IN ('pending', 'acknowledged', 'acted', 'dismissed')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- News events processed
CREATE TABLE news_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  headline TEXT NOT NULL,
  source TEXT,
  url TEXT,
  published_at TIMESTAMPTZ,
  affected_tickers TEXT[],
  affected_asset_classes TEXT[],
  classification TEXT CHECK (classification IN ('positive', 'negative', 'neutral')),
  materiality DECIMAL(3,2), -- 0.0 to 1.0
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Portfolio impact alerts
CREATE TABLE portfolio_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  news_event_id UUID REFERENCES news_events,
  impact_classification TEXT CHECK (impact_classification IN ('positive', 'negative', 'neutral')),
  affected_holdings TEXT[],
  estimated_dollar_impact DECIMAL(12,2),
  plain_english_explanation TEXT,
  action_required BOOLEAN DEFAULT FALSE,
  urgency TEXT CHECK (urgency IN ('act_now', 'act_soon', 'monitor', 'info_only')),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recommendation accuracy tracking (calibration)
CREATE TABLE recommendation_calibration (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recommendation_id UUID REFERENCES rebalancing_recommendations,
  user_id UUID REFERENCES auth.users NOT NULL,
  recommended_at TIMESTAMPTZ,
  evaluated_at TIMESTAMPTZ,
  portfolio_value_at_recommendation DECIMAL(12,2),
  portfolio_value_30_days_later DECIMAL(12,2),
  recommendation_was_correct BOOLEAN,
  notes TEXT
);
```

Enable Row Level Security on all tables:
```sql
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
-- (repeat for all tables)

-- Policy example (repeat for each table):
CREATE POLICY "Users can only access their own data"
ON holdings FOR ALL
USING (auth.uid() = user_id);
```

---

## MULTI-AGENT PIPELINE ARCHITECTURE

### Agent Hierarchy
```
OrchestratorAgent (master controller)
├── NewsIngestionAgent (monitors financial news 24/7)
├── PortfolioSyncAgent (keeps holdings/prices updated)
├── ClassificationAgent (Claude classifies news impact)
├── RebalancingAgent (detects drift, generates recommendations)
├── AlertAgent (notifies users of important events)
└── CalibrationAgent (tracks recommendation accuracy)
```

### OrchestratorAgent
File: `agents/orchestrator.py`
- Spins up all other agents on startup
- Routes news events to ClassificationAgent
- Routes classification results to RebalancingAgent and AlertAgent
- Handles agent failures gracefully — if one agent crashes, log it and restart, never crash the whole pipeline
- Runs a `/health` FastAPI endpoint showing status of all agents

```python
@app.get("/health")
def health():
    return {
        "status": "alive",
        "agents": {
            "news_ingestion": news_agent.status(),
            "portfolio_sync": portfolio_agent.status(),
            "classification": classification_agent.status(),
            "rebalancing": rebalancing_agent.status(),
            "alert": alert_agent.status()
        },
        "last_news_event": news_agent.last_event_time,
        "alerts_sent_today": alert_agent.count_today()
    }
```

### NewsIngestionAgent
File: `agents/news_ingestion.py`
Adapted from `news_stream.py` in reference repo.
- Poll Yahoo Finance RSS feed every 5 minutes
- Poll FRED API for macro indicator changes (interest rates, inflation, unemployment)
- Poll NewsAPI for market-moving headlines
- Deduplicate events (store hash of headline in Redis or Supabase to avoid reprocessing)
- Extract mentioned tickers and asset classes from headlines
- Hand off to OrchestratorAgent immediately on new event

Sources to monitor:
```python
NEWS_SOURCES = [
    "https://finance.yahoo.com/news/rssindex",
    "https://feeds.finance.yahoo.com/rss/2.0/headline",
]

FRED_INDICATORS = [
    "FEDFUNDS",   # Federal funds rate
    "CPIAUCSL",   # CPI inflation
    "UNRATE",     # Unemployment rate
    "DGS10",      # 10-year treasury yield
    "SP500",      # S&P 500
]

MACRO_KEYWORDS = [
    "fed rate", "interest rate", "inflation", "recession", "gdp",
    "unemployment", "earnings", "dividend", "merger", "acquisition",
    "bankruptcy", "sec", "investigation", "rate hike", "rate cut"
]
```

### PortfolioSyncAgent
File: `agents/portfolio_sync.py`
- Run every 15 minutes during market hours (9:30am-4pm EST weekdays)
- Run once daily after market close for end-of-day snapshot
- For each user's holdings, fetch current price via yfinance
- Update `holdings.current_price` and `holdings.current_value` in Supabase
- Recalculate portfolio allocation percentages
- Save daily snapshot to `portfolio_snapshots`
- Detect if any user's portfolio has drifted past their rebalancing threshold
- If drift detected, send to RebalancingAgent

```python
import yfinance as yf

def update_holding_price(ticker: str):
    stock = yf.Ticker(ticker)
    info = stock.fast_info
    return info.last_price

def calculate_allocation(holdings: list) -> dict:
    total_value = sum(h.current_value for h in holdings)
    allocation = {}
    for holding in holdings:
        asset_class = holding.asset_class
        allocation[asset_class] = allocation.get(asset_class, 0) + (holding.current_value / total_value)
    return allocation
```

### ClassificationAgent
File: `agents/classifier.py`
Directly adapted from `classifier.py` in reference repo — this is the most important file.

**Critical design principle from reference repo:** Ask Claude to CLASSIFY (bullish/bearish/neutral), NOT to predict probabilities. LLMs are good at classification, not calibrated probability estimation.

```python
async def classify_news_impact(news_event: dict, user_portfolio: dict) -> dict:
    prompt = f"""You are a financial advisor analyzing news for a specific investor.

USER PORTFOLIO:
{json.dumps(user_portfolio, indent=2)}

USER GOALS:
{json.dumps(user_portfolio['goals'], indent=2)}

NEWS EVENT:
Headline: {news_event['headline']}
Source: {news_event['source']}
Published: {news_event['published_at']}

Analyze this news and respond with ONLY a JSON object:
{{
    "affected_holdings": ["list of tickers in portfolio this news affects"],
    "affected_asset_classes": ["list of asset classes affected"],
    "impact": "positive" | "negative" | "neutral",
    "materiality": 0.0-1.0,  // how much should this move prices for this user?
    "urgency": "act_now" | "act_soon" | "monitor" | "info_only",
    "estimated_dollar_impact": 0.00,  // estimated $ change to user's portfolio
    "plain_english_explanation": "one sentence a non-investor would understand",
    "action_recommended": true | false,
    "action_description": "specific action in plain English or null"
}}

Rules:
- materiality above 0.6 = significant news worth alerting user
- If no holdings are affected, return impact: "neutral" and materiality: 0.0
- Dollar impact should be a rough estimate based on historical sensitivity
- Plain English explanation must mention the user's specific holdings by name, never tickers
- Never use financial jargon without explaining it"""

    response = anthropic_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )
    
    return json.loads(response.content[0].text)
```

### RebalancingAgent
File: `agents/rebalancing.py`
This is the core financial intelligence. Implement all four rebalancing strategies:

**Strategy 1: Calendar Rebalancing**
```python
def check_calendar_rebalancing(user_id: str, goal: dict) -> bool:
    frequency = goal['rebalancing_frequency']
    last_rebalance = get_last_rebalance_date(user_id, goal['id'])
    
    if frequency == 'monthly':
        return (datetime.now() - last_rebalance).days >= 30
    elif frequency == 'quarterly':
        return (datetime.now() - last_rebalance).days >= 90
    elif frequency == 'annually':
        return (datetime.now() - last_rebalance).days >= 365
```

**Strategy 2: Threshold (Band) Rebalancing**
```python
def check_threshold_rebalancing(current_allocation: dict, target_allocation: dict, threshold: float) -> dict:
    drift = {}
    needs_rebalancing = False
    
    for asset_class, target_pct in target_allocation.items():
        current_pct = current_allocation.get(asset_class, 0)
        drift_amount = current_pct - target_pct
        drift[asset_class] = drift_amount
        
        if abs(drift_amount) > threshold:
            needs_rebalancing = True
    
    return {"needs_rebalancing": needs_rebalancing, "drift": drift}
```

**Strategy 3: Hybrid (Calendar + Threshold)**
```python
def check_hybrid_rebalancing(user_id, goal, current_allocation, target_allocation):
    calendar_triggered = check_calendar_rebalancing(user_id, goal)
    threshold_result = check_threshold_rebalancing(
        current_allocation, target_allocation, goal['rebalancing_threshold']
    )
    # Only act if BOTH calendar says check AND threshold says drift is significant
    return calendar_triggered and threshold_result['needs_rebalancing']
```

**Strategy 4: Cash Flow Rebalancing**
```python
def calculate_cashflow_rebalancing(new_deposit: float, current_allocation: dict, target_allocation: dict, holdings: list) -> list:
    # Use new money to buy underweighted assets instead of selling
    trades = []
    for asset_class, target_pct in target_allocation.items():
        current_pct = current_allocation.get(asset_class, 0)
        if current_pct < target_pct:
            # Put more of the new deposit here
            amount_to_buy = new_deposit * (target_pct - current_pct)
            trades.append({
                "action": "buy",
                "asset_class": asset_class,
                "amount": amount_to_buy,
                "reason": f"Underweight by {(target_pct - current_pct)*100:.1f}%"
            })
    return trades
```

**Urgency Calculation (adapted from edge.py Kelly logic):**
```python
def calculate_rebalancing_urgency(drift_pct: float, years_to_goal: float, asset_volatility: float) -> str:
    # More urgent if: large drift + goal is soon + high volatility asset
    urgency_score = (drift_pct * asset_volatility) / max(years_to_goal, 0.5)
    
    if urgency_score > 0.15:
        return "act_now"
    elif urgency_score > 0.08:
        return "act_soon"
    else:
        return "monitor"
```

**Tax-Loss Harvesting Check:**
```python
def check_tax_loss_harvesting(holdings: list, rebalancing_needed: dict) -> dict:
    # When rebalancing requires selling, check for losses first
    tax_opportunities = []
    
    for holding in holdings:
        unrealized_gain_loss = holding.current_value - (holding.shares * holding.avg_cost_basis)
        if unrealized_gain_loss < -100:  # meaningful loss threshold
            tax_opportunities.append({
                "ticker": holding.ticker,
                "name": holding.name,
                "unrealized_loss": unrealized_gain_loss,
                "note": f"Selling {holding.name} captures a ${abs(unrealized_gain_loss):.0f} tax deduction"
            })
    
    return tax_opportunities
```

**Glide Path — Target Allocation By Goal Timeline:**
```python
GLIDE_PATH = {
    "retirement": {
        20: {"us_stocks": 0.70, "intl_stocks": 0.20, "bonds": 0.10, "cash": 0.00},
        15: {"us_stocks": 0.60, "intl_stocks": 0.15, "bonds": 0.20, "cash": 0.05},
        10: {"us_stocks": 0.50, "intl_stocks": 0.10, "bonds": 0.30, "cash": 0.10},
        5:  {"us_stocks": 0.35, "intl_stocks": 0.05, "bonds": 0.45, "cash": 0.15},
        2:  {"us_stocks": 0.20, "intl_stocks": 0.00, "bonds": 0.50, "cash": 0.30},
    },
    "house": {
        5:  {"us_stocks": 0.40, "intl_stocks": 0.00, "bonds": 0.40, "cash": 0.20},
        3:  {"us_stocks": 0.20, "intl_stocks": 0.00, "bonds": 0.30, "cash": 0.50},
        1:  {"us_stocks": 0.00, "intl_stocks": 0.00, "bonds": 0.20, "cash": 0.80},
    },
    "college": {
        10: {"us_stocks": 0.70, "intl_stocks": 0.05, "bonds": 0.20, "cash": 0.05},
        5:  {"us_stocks": 0.40, "intl_stocks": 0.00, "bonds": 0.40, "cash": 0.20},
        2:  {"us_stocks": 0.10, "intl_stocks": 0.00, "bonds": 0.40, "cash": 0.50},
    },
    "emergency": {
        0:  {"us_stocks": 0.00, "intl_stocks": 0.00, "bonds": 0.00, "cash": 1.00},
    }
}

def get_target_allocation(goal_type: str, years_to_goal: float) -> dict:
    path = GLIDE_PATH.get(goal_type, GLIDE_PATH["retirement"])
    # Find the closest timeline bucket
    available_years = sorted(path.keys())
    for years in available_years:
        if years_to_goal <= years:
            return path[years]
    return path[max(available_years)]
```

### AlertAgent
File: `agents/alert_agent.py`
- Receive completed classification + rebalancing signal from Orchestrator
- Format personalized plain English alert for the user
- Push to user via Supabase real-time subscription (frontend listens and shows notification)
- Store in `portfolio_alerts` table
- For `act_now` urgency, also send email via Supabase edge functions

### CalibrationAgent
File: `agents/calibrator.py`
Directly adapted from `calibrator.py` in reference repo.
- Run nightly
- For all rebalancing recommendations made 30 days ago, check if they improved portfolio performance
- Store result in `recommendation_calibration` table
- Show accuracy stats on dashboard: "Our rebalancing recommendations improved portfolio performance X% of the time"

---

## CLAUDE API — CONVERSATIONAL ADVISOR

### System Prompt Architecture
Every chat message to Claude must include the user's full financial context:

```python
def build_system_prompt(user_data: dict) -> str:
    return f"""You are a friendly, knowledgeable financial advisor for everyday investors.
    
CRITICAL RULES:
- NEVER use financial jargon without immediately explaining it in plain English
- ALWAYS reference the user's specific numbers and holdings, never give generic advice
- ALWAYS explain WHY before WHAT — help users understand, not just follow instructions
- Speak like a trusted friend who happens to be a financial expert, not a robot or salesman
- When recommending action, always explain the downside risk too
- Never guarantee returns or make specific predictions
- If you detect the user is about to make an emotional decision (panic selling, FOMO), gently intervene

USER PROFILE:
Name: {user_data['full_name']}
Risk Tolerance: {user_data['risk_tolerance']}
Risk Capacity: {user_data['risk_capacity']}

GOALS:
{json.dumps(user_data['goals'], indent=2)}

CURRENT PORTFOLIO:
Total Value: ${user_data['portfolio_value']:,.2f}
Current Allocation: {json.dumps(user_data['current_allocation'], indent=2)}
Target Allocation: {json.dumps(user_data['target_allocation'], indent=2)}
Drift from Target: {json.dumps(user_data['allocation_drift'], indent=2)}

HOLDINGS:
{json.dumps(user_data['holdings'], indent=2)}

RECENT ALERTS:
{json.dumps(user_data['recent_alerts'], indent=2)}

TODAY'S MARKET CONTEXT:
{user_data['market_context']}"""
```

### Claude Tool Definitions
Give Claude these tools so it can fetch live data mid-conversation:

```python
TOOLS = [
    {
        "name": "get_stock_info",
        "description": "Get current price, performance, and basic info for a stock or ETF ticker",
        "input_schema": {
            "type": "object",
            "properties": {"ticker": {"type": "string"}},
            "required": ["ticker"]
        }
    },
    {
        "name": "get_fund_breakdown",
        "description": "Get what's inside a mutual fund or ETF — top holdings, sector breakdown, expense ratio",
        "input_schema": {
            "type": "object",
            "properties": {"ticker": {"type": "string"}},
            "required": ["ticker"]
        }
    },
    {
        "name": "run_scenario",
        "description": "Simulate how the user's current portfolio would have performed in a historical scenario",
        "input_schema": {
            "type": "object",
            "properties": {
                "scenario": {
                    "type": "string",
                    "enum": ["2008_financial_crisis", "covid_crash_2020", "2022_rate_hikes", "dot_com_crash", "high_inflation"]
                }
            },
            "required": ["scenario"]
        }
    },
    {
        "name": "check_goal_progress",
        "description": "Calculate if user is on track for a specific financial goal based on current portfolio and projected growth",
        "input_schema": {
            "type": "object",
            "properties": {"goal_id": {"type": "string"}},
            "required": ["goal_id"]
        }
    },
    {
        "name": "get_rebalancing_recommendation",
        "description": "Generate a fresh rebalancing recommendation for the user's portfolio",
        "input_schema": {
            "type": "object",
            "properties": {"goal_id": {"type": "string"}},
            "required": ["goal_id"]
        }
    },
    {
        "name": "get_macro_data",
        "description": "Get current macroeconomic indicators — interest rates, inflation, market conditions",
        "input_schema": {"type": "object", "properties": {}}
    }
]
```

### Behavioral Intervention Detection
Add a pre-check before sending user message to Claude. If the message suggests emotional decision-making, prepend a behavioral intervention context:

```python
EMOTIONAL_PATTERNS = [
    ("sell everything", "panic_selling"),
    ("sell all", "panic_selling"),
    ("get out", "panic_selling"),
    ("pull out my money", "panic_selling"),
    ("everyone is buying", "fomo"),
    ("i need to buy", "fomo"),
    ("going to the moon", "fomo"),
    ("i lost so much", "loss_aversion"),
    ("should i be worried", "anxiety"),
]

def detect_emotional_intent(message: str) -> str | None:
    message_lower = message.lower()
    for pattern, intent_type in EMOTIONAL_PATTERNS:
        if pattern in message_lower:
            return intent_type
    return None

def build_behavioral_context(intent_type: str, portfolio_data: dict) -> str:
    if intent_type == "panic_selling":
        return """The user appears to be considering panic selling. 
        Gently acknowledge their concern, validate the emotion, 
        then provide historical data showing that investors who held 
        through similar drops recovered. Reference their specific 
        timeline and whether they actually need this money soon."""
    elif intent_type == "fomo":
        return """The user appears to be considering a FOMO purchase. 
        Gently explain the risks of chasing returns, reference their 
        existing allocation, and ask if this would fit their actual goals."""
    # etc.
```

---

## REACT FRONTEND STRUCTURE

### Pages / Routes
```
/                   → Landing page (marketing)
/login              → Supabase Auth UI
/signup             → Supabase Auth UI  
/onboarding         → Multi-step goal + holdings setup
/dashboard          → Main portfolio overview
/dashboard/chat     → AI advisor chat
/dashboard/goals    → Goal tracker
/dashboard/alerts   → Portfolio alerts feed
/dashboard/rebalance → Rebalancing recommendations
/dashboard/scenarios → Macro scenario simulator
```

### Dashboard Layout
```
┌─────────────────────────────────────────────────────────┐
│  HEADER: Logo | Portfolio Value: $127,430 ↑2.3% | User  │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│  SIDEBAR │  MAIN CONTENT AREA                           │
│          │                                              │
│ Overview │  Portfolio Chart (line, 1D/1W/1M/1Y/ALL)     │
│ Goals    │                                              │
│ Alerts 🔴│  Allocation Donut Chart + Target vs Current  │
│ Chat     │                                              │
│ Rebalance│  Holdings Table                              │
│ Scenarios│  (Ticker | Name | Value | % | 1D Change)     │
│          │                                              │
│          │  Recent Alerts Feed                          │
└──────────┴──────────────────────────────────────────────┘
```

### Chat Component
- Stream Claude responses (do not wait for full response — stream token by token)
- Show typing indicator while waiting
- Render markdown in responses (bold, bullet points)
- Show tool call activity: "Fetching your Apple stock data..." while tool executes
- Keep full conversation history in component state
- Persist history to Supabase `chat_history` table

### Real-Time Updates
Use Supabase real-time subscriptions:
```javascript
// Subscribe to new alerts for this user
const alertsSubscription = supabase
  .channel('portfolio_alerts')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'portfolio_alerts',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    showAlertNotification(payload.new)
  })
  .subscribe()
```

### Onboarding Flow (Multi-Step)
Step 1: "What are you investing for?" — Goal type selection (retirement/house/college/other)
Step 2: "When do you need this money?" — Timeline input
Step 3: "How stable is your income?" + "Do you have an emergency fund?" — Risk capacity assessment (NOT just risk tolerance)
Step 4: "What do you currently own?" — Holdings input (ticker + shares + avg cost)
Step 5: Account type selection (401k/IRA/taxable)
Step 6: AI generates target allocation based on glide path — show it, explain it, ask user to confirm

**After onboarding:** AI immediately analyzes current vs target allocation and sends first rebalancing recommendation if needed.

---

## MACRO SCENARIO SIMULATOR

Implement historical scenario backtesting adapted from `backtest.py`:

```python
SCENARIOS = {
    "2008_financial_crisis": {
        "name": "2008 Financial Crisis",
        "description": "The worst financial crisis since the Great Depression",
        "duration_months": 17,
        "asset_returns": {
            "us_stocks": -0.51,
            "intl_stocks": -0.54,
            "bonds": +0.05,
            "cash": +0.02,
            "real_estate": -0.40,
        }
    },
    "covid_crash_2020": {
        "name": "COVID Crash (Feb-Mar 2020)",
        "description": "The fastest bear market in history",
        "duration_months": 2,
        "asset_returns": {
            "us_stocks": -0.34,
            "intl_stocks": -0.32,
            "bonds": +0.08,
            "cash": +0.00,
            "real_estate": -0.20,
        }
    },
    "2022_rate_hikes": {
        "name": "2022 Fed Rate Hikes",
        "description": "Aggressive interest rate increases caused both stocks and bonds to fall",
        "duration_months": 12,
        "asset_returns": {
            "us_stocks": -0.19,
            "intl_stocks": -0.16,
            "bonds": -0.13,
            "cash": +0.03,
        }
    },
    "dot_com_crash": {
        "name": "Dot-Com Crash (2000-2002)",
        "description": "The collapse of the tech bubble",
        "duration_months": 30,
        "asset_returns": {
            "us_stocks": -0.49,
            "intl_stocks": -0.45,
            "bonds": +0.30,
            "cash": +0.10,
        }
    }
}

def run_scenario(portfolio_holdings: list, scenario_key: str) -> dict:
    scenario = SCENARIOS[scenario_key]
    results = []
    total_impact = 0
    
    for holding in portfolio_holdings:
        asset_class_return = scenario['asset_returns'].get(holding['asset_class'], 0)
        dollar_impact = holding['current_value'] * asset_class_return
        total_impact += dollar_impact
        
        results.append({
            "name": holding['name'],
            "ticker": holding['ticker'],
            "current_value": holding['current_value'],
            "scenario_value": holding['current_value'] + dollar_impact,
            "dollar_change": dollar_impact,
            "pct_change": asset_class_return * 100
        })
    
    return {
        "scenario": scenario['name'],
        "description": scenario['description'],
        "total_portfolio_before": sum(h['current_value'] for h in portfolio_holdings),
        "total_portfolio_after": sum(h['current_value'] for h in portfolio_holdings) + total_impact,
        "total_dollar_impact": total_impact,
        "holdings_breakdown": results,
        "plain_english": f"In a {scenario['name']}, your portfolio would have lost approximately ${abs(total_impact):,.0f}. Here's how each holding would have been affected."
    }
```

---

## API ENDPOINTS (FastAPI)

```
POST   /api/auth/signup
POST   /api/auth/login

GET    /api/user/profile
PUT    /api/user/profile

POST   /api/goals
GET    /api/goals
PUT    /api/goals/{goal_id}
DELETE /api/goals/{goal_id}

POST   /api/holdings
GET    /api/holdings
PUT    /api/holdings/{holding_id}
DELETE /api/holdings/{holding_id}
POST   /api/holdings/sync-prices         # triggers PortfolioSyncAgent for this user

GET    /api/portfolio/summary            # total value, allocation, drift
GET    /api/portfolio/history            # snapshots over time
GET    /api/portfolio/allocation         # current vs target

GET    /api/alerts                       # all unread alerts
PUT    /api/alerts/{alert_id}/read

GET    /api/rebalancing/recommendations  # current open recommendations
POST   /api/rebalancing/trigger          # manually trigger rebalancing check
PUT    /api/rebalancing/{rec_id}/status  # acknowledge/act/dismiss

POST   /api/scenarios/run               # body: {scenario_key, goal_id}

POST   /api/chat                        # streaming endpoint
GET    /api/chat/history

GET    /api/calibration/stats           # recommendation accuracy over time

GET    /health                          # agent health check
```

---

## FINANCIAL LOGIC — KEY CONCEPTS TO IMPLEMENT CORRECTLY

### Risk Capacity vs Risk Tolerance (BOTH must be assessed)
```
Risk Tolerance = emotional: "How do you feel about losing 20%?"
Risk Capacity  = financial: "Can your situation survive a 20% loss?"

Assess risk capacity from:
- Time horizon to goal (longer = higher capacity)
- Income stability (stable job = higher capacity)
- Emergency fund existence (yes = higher capacity)
- Number of dependents (more = lower capacity)
- Other assets outside this portfolio (more = higher capacity)

If risk_tolerance > risk_capacity: use risk_capacity as the binding constraint
Tell the user: "You said you're comfortable with risk, but based on your 
2-year timeline and lack of emergency fund, we recommend a more conservative 
approach. Here's why..."
```

### Modern Portfolio Theory Application
When analyzing a portfolio, calculate:
- Expected return (weighted average of asset class expected returns)
- Portfolio volatility (use correlation matrix between asset classes)
- Sharpe ratio (excess return per unit of risk)
- Tell user if their portfolio is inefficient: taking more risk than necessary for their expected return

### Rebalancing Bonus (Shannon's Demon) — Explain to Users
Mathematically, rebalancing a volatile portfolio back to target allocation generates approximately 0.5-1.5% annual return premium over buy-and-hold. When recommending rebalancing, mention this: "Regular rebalancing can add an estimated 0.5-1% to your annual returns over time — it's not just risk management, it's a return strategy."

### Tax Considerations
- 401k/IRA: No tax on rebalancing trades — rebalance freely
- Taxable accounts: Selling triggers capital gains tax
  - Short-term (held < 1 year): taxed as ordinary income
  - Long-term (held > 1 year): taxed at lower capital gains rate
  - Always flag this when recommending sells in taxable accounts
  - Always check for tax-loss harvesting opportunities first

---

## ERROR HANDLING & RESILIENCE

Every agent must have try/except wrapping its main loop:
```python
async def run(self):
    while True:
        try:
            await self._run_cycle()
        except Exception as e:
            logger.error(f"{self.__class__.__name__} error: {e}")
            await asyncio.sleep(60)  # wait before retrying, don't crash
```

All API endpoints must return structured errors:
```python
{"error": "description", "code": "ERROR_CODE", "details": {...}}
```

---

## PROJECT FILE STRUCTURE

```
/
├── CLAUDE.md                    # this file
├── README.md
├── .env.example
├── .gitignore
├── requirements.txt
├── Procfile                     # Railway deployment
│
├── agents/
│   ├── orchestrator.py
│   ├── news_ingestion.py        # adapted from news_stream.py
│   ├── portfolio_sync.py
│   ├── classifier.py            # adapted from classifier.py
│   ├── rebalancing.py           # adapted from edge.py
│   ├── alert_agent.py           # adapted from executor.py
│   └── calibrator.py            # adapted from calibrator.py
│
├── api/
│   ├── main.py                  # FastAPI app, all routes
│   ├── auth.py
│   ├── portfolio.py
│   ├── goals.py
│   ├── holdings.py
│   ├── chat.py                  # streaming Claude endpoint
│   ├── scenarios.py
│   └── rebalancing.py
│
├── core/
│   ├── config.py                # all settings (adapted from config.py)
│   ├── database.py              # Supabase client
│   ├── claude_client.py         # Anthropic client + tool handling
│   └── logger.py                # adapted from logger.py
│
├── financial/
│   ├── glide_path.py            # target allocation tables
│   ├── rebalancing_math.py      # drift calc, Kelly urgency, tax-loss harvest
│   ├── scenario_data.py         # historical scenario returns
│   ├── risk_assessment.py       # capacity vs tolerance logic
│   └── portfolio_math.py        # MPT calculations, Sharpe ratio
│
├── data/
│   ├── market_data.py           # yfinance wrapper
│   ├── fred_client.py           # FRED API wrapper
│   ├── news_client.py           # NewsAPI wrapper
│   └── fund_data.py             # Alpha Vantage mutual fund data
│
└── frontend/                    # React app
    ├── src/
    │   ├── pages/
    │   │   ├── Landing.jsx
    │   │   ├── Onboarding.jsx
    │   │   ├── Dashboard.jsx
    │   │   ├── Chat.jsx
    │   │   ├── Goals.jsx
    │   │   ├── Alerts.jsx
    │   │   ├── Rebalancing.jsx
    │   │   └── Scenarios.jsx
    │   ├── components/
    │   │   ├── PortfolioChart.jsx
    │   │   ├── AllocationDonut.jsx
    │   │   ├── HoldingsTable.jsx
    │   │   ├── AlertCard.jsx
    │   │   ├── ChatMessage.jsx
    │   │   ├── RebalancingCard.jsx
    │   │   └── ScenarioResult.jsx
    │   ├── hooks/
    │   │   ├── usePortfolio.js
    │   │   ├── useAlerts.js
    │   │   └── useRealtimeAlerts.js
    │   └── lib/
    │       ├── supabase.js
    │       └── api.js
    └── package.json
```

---

## DEMO FLOW FOR JUDGES (3 minutes)

Build the app so this exact demo path works flawlessly:

1. **Login** as demo user (pre-seeded with realistic portfolio)
2. **Dashboard** shows portfolio value, allocation donut vs target, one pending alert
3. **Click alert** — "Fed raised rates today. Your bond funds dropped ~$340. Here's what I recommend."
4. **Chat** — type "Am I ready to retire in 5 years?" → Claude responds with their specific numbers
5. **Scenarios** — run "2008 Financial Crisis" → shows dollar impact by holding
6. **Rebalancing** — click pending recommendation → shows what to buy/sell, why, tax notes
7. **Calibration stat** on dashboard — "Our recommendations improved portfolio performance 73% of the time"

Pre-seed this demo data in Supabase before the hackathon.

---

## WHAT TO SAY TO JUDGES

Use this language — it shows financial expertise:

- "We implement threshold rebalancing with configurable drift bands, adapted per account type"
- "We separate risk capacity from risk tolerance — most tools only ask one"
- "We flag tax-loss harvesting opportunities when rebalancing requires selling in taxable accounts"
- "We use a glide path model that automatically shifts target allocation as goal dates approach"
- "The classification architecture asks Claude to classify impact — bullish/bearish/neutral — rather than predict probabilities, which is a task LLMs are genuinely good at"
- "We track recommendation accuracy over time using a calibration framework — we can tell you if our advice actually worked"
- "Rebalancing isn't just risk management — Shannon's Demon shows it generates a 0.5-1.5% annual return premium"

---

## SETUP ORDER (DO THIS FIRST)

1. Create GitHub repo
2. Create Supabase project → run all SQL schema above → get SUPABASE_URL and SUPABASE_SERVICE_KEY
3. Get all API keys: Anthropic, Alpha Vantage (free), FRED (free), NewsAPI (free)
4. Clone polymarket-pipeline repo → copy the files listed above into `/agents/` folder
5. Connect Railway to GitHub repo → add all env vars → deploy
6. Create Vercel project → connect to GitHub → deploy frontend
7. Set up UptimeRobot to monitor Railway `/health` endpoint
8. Seed demo data into Supabase for hackathon demo

---

*Built for HackUTD 2025 — Goldman Sachs "Empowering the Everyday Investor" Challenge*
