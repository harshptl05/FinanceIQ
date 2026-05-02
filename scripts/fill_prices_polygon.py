"""
Fill current prices and a year of daily portfolio_snapshots using
Polygon.io (free tier, in our .env). yfinance has been rate-limiting us,
and a dashboard with $0 everywhere isn't useful. This is the same data,
just from a different free source.

Usage:
  python scripts/fill_prices_polygon.py <email_or_substring>
"""
import os
import sys
import time
from pathlib import Path
from datetime import date, timedelta, datetime
from dotenv import load_dotenv
import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
load_dotenv()

POLYGON_KEY = os.environ["POLYGON_API_KEY"]

if len(sys.argv) < 2:
    print("Usage: python scripts/fill_prices_polygon.py <email_or_substring>")
    sys.exit(1)
needle = sys.argv[1].lower()

from supabase import create_client
db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

# Find user
matches = []
page = 1
while True:
    resp = db.auth.admin.list_users(page=page, per_page=50)
    users = resp if isinstance(resp, list) else getattr(resp, "users", []) or []
    if not users:
        break
    for u in users:
        em = (getattr(u, "email", "") or "").lower()
        if needle in em:
            matches.append((u.id, em))
    if len(users) < 50:
        break
    page += 1
if not matches or len(matches) > 1:
    print("No / multiple matches. Be more specific.")
    sys.exit(2)
user_id, email = matches[0]
print(f"Working on {email} ({user_id})")

# Pull holdings
holdings = db.table("holdings").select("*").eq("user_id", user_id).execute().data or []
if not holdings:
    print("No holdings to update.")
    sys.exit(0)

# Pull last year of daily closes for each ticker from Polygon.
# Endpoint: /v2/aggs/ticker/{ticker}/range/1/day/{from}/{to}
end = date.today()
start = end - timedelta(days=365)


def fetch_history(ticker: str) -> list[dict]:
    """Return list of {date: 'YYYY-MM-DD', close: float} ascending."""
    url = (
        f"https://api.polygon.io/v2/aggs/ticker/{ticker}/range/1/day/"
        f"{start.isoformat()}/{end.isoformat()}"
        f"?adjusted=true&sort=asc&limit=5000&apiKey={POLYGON_KEY}"
    )
    try:
        r = httpx.get(url, timeout=15)
        if r.status_code == 429:
            print(f"  {ticker}: 429 from Polygon — sleeping 13s")
            time.sleep(13)
            r = httpx.get(url, timeout=15)
        if r.status_code != 200:
            print(f"  {ticker}: HTTP {r.status_code} {r.text[:120]}")
            return []
        data = r.json().get("results") or []
        return [
            {
                "date": datetime.utcfromtimestamp(p["t"] / 1000).date().isoformat(),
                "close": float(p["c"]),
            }
            for p in data
        ]
    except Exception as e:
        print(f"  {ticker}: {e}")
        return []


# 1) Fetch history for every ticker
ticker_history: dict[str, list[dict]] = {}
for h in holdings:
    tk = h["ticker"]
    if tk == "VMFXX":
        # money market: just pin to $1.00 every day
        ticker_history[tk] = [
            {"date": (start + timedelta(days=i)).isoformat(), "close": 1.0}
            for i in range((end - start).days + 1)
        ]
        continue
    print(f"Fetching {tk}...")
    hist = fetch_history(tk)
    if hist:
        print(f"  got {len(hist)} bars (latest close ${hist[-1]['close']:.2f})")
    ticker_history[tk] = hist
    time.sleep(13)  # Polygon free tier: 5 req/min

# 2) Update holdings with the latest close
for h in holdings:
    tk = h["ticker"]
    hist = ticker_history.get(tk, [])
    if not hist:
        continue
    last = hist[-1]["close"]
    db.table("holdings").update({
        "current_price": last,
        "current_value": round(last * float(h["shares"]), 2),
    }).eq("id", h["id"]).execute()

# 3) Build daily portfolio snapshots: for each business day in the last
#    year, sum (shares * close-on-that-day) across all holdings. This gives
#    the chart real history immediately.
print("Building portfolio_snapshots...")
all_dates = sorted({d["date"] for tk in ticker_history.values() for d in tk})
# Index by ticker -> date -> close
indexed = {tk: {d["date"]: d["close"] for d in arr} for tk, arr in ticker_history.items()}

# Wipe existing snapshots for this user before re-seeding
db.table("portfolio_snapshots").delete().eq("user_id", user_id).execute()

inserted = 0
last_close = {tk: None for tk in indexed}
for d in all_dates:
    total = 0.0
    for h in holdings:
        tk = h["ticker"]
        c = indexed.get(tk, {}).get(d) or last_close.get(tk)
        if c is None:
            continue
        last_close[tk] = c
        total += c * float(h["shares"])
    if total <= 0:
        continue
    db.table("portfolio_snapshots").insert({
        "user_id": user_id,
        "total_value": round(total, 2),
        "snapshot_date": d,
    }).execute()
    inserted += 1
print(f"  inserted {inserted} snapshots ({all_dates[0]} → {all_dates[-1]})")

# 4) Print summary
holdings = db.table("holdings").select("ticker, current_price, current_value").eq("user_id", user_id).execute().data or []
total = sum(float(h.get("current_value") or 0) for h in holdings)
print()
print(f"Portfolio total: ${total:,.2f}")
for h in holdings:
    print(f"  {h['ticker']:6s}  ${float(h.get('current_price') or 0):,.2f}  → ${float(h.get('current_value') or 0):,.2f}")
