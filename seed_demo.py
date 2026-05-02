"""
Seed demo data into Supabase for the hackathon demo.

Usage:
  python seed_demo.py            # seed (idempotent for the demo user)
  python seed_demo.py --reset    # wipe demo user data first, then seed

This script intentionally does NOT insert any fabricated news alerts or
rebalancing recommendations that claim things happened "today". Real
alerts are produced by the live news + classification pipeline so that
nothing displayed in the UI is invented.

Requires .env with SUPABASE_URL, SUPABASE_SERVICE_KEY, and DEMO_USER_ID.
"""
import os
import sys
from datetime import date, timedelta
from dotenv import load_dotenv

load_dotenv()

DEMO_USER_ID = os.environ.get("DEMO_USER_ID", "")
if not DEMO_USER_ID or DEMO_USER_ID.startswith("REPLACE"):
    print("ERROR: Set DEMO_USER_ID in .env to the Supabase Auth user UUID.")
    sys.exit(1)

from supabase import create_client

db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

RESET = "--reset" in sys.argv

if RESET:
    print(f"Resetting demo data for user {DEMO_USER_ID}...")
    for table in (
        "portfolio_alerts",
        "rebalancing_recommendations",
        "recommendation_calibration",
        "portfolio_snapshots",
        "holdings",
        "chat_history",
        "goals",
    ):
        db.table(table).delete().eq("user_id", DEMO_USER_ID).execute()

# Profile (upsert so it's safe to rerun)
db.table("user_profiles").upsert({
    "id": DEMO_USER_ID,
    "full_name": "Alex Johnson",
    "risk_tolerance": "moderate",
    "risk_capacity": "medium",
}).execute()

# Goal (only insert if user has none — avoid duplicate goals on rerun)
existing_goals = db.table("goals").select("id").eq("user_id", DEMO_USER_ID).execute()
if existing_goals.data:
    goal_id = existing_goals.data[0]["id"]
else:
    target_date = (date.today() + timedelta(days=365 * 22)).isoformat()
    goal = db.table("goals").insert({
        "user_id": DEMO_USER_ID,
        "goal_type": "retirement",
        "goal_name": "Retirement Fund",
        "target_date": target_date,
        "target_amount": 1500000,
        "current_amount": 127430,
        "target_allocation": {"us_stocks": 0.60, "intl_stocks": 0.15, "bonds": 0.20, "cash": 0.05},
        "rebalancing_strategy": "hybrid",
        "rebalancing_threshold": 0.05,
        "rebalancing_frequency": "quarterly",
        "account_type": "401k",
    }).execute().data[0]
    goal_id = goal["id"]

# Holdings — only seed if the user has none, so live prices aren't overwritten
existing_holdings = db.table("holdings").select("id").eq("user_id", DEMO_USER_ID).execute()
if not existing_holdings.data:
    holdings = [
        {"ticker": "VTI",   "name": "Vanguard Total Stock Market ETF",        "asset_class": "us_stocks",   "shares": 250,   "avg_cost_basis": 195.40},
        {"ticker": "VXUS",  "name": "Vanguard Total International Stock ETF", "asset_class": "intl_stocks", "shares": 400,   "avg_cost_basis": 52.30},
        {"ticker": "BND",   "name": "Vanguard Total Bond Market ETF",         "asset_class": "bonds",       "shares": 300,   "avg_cost_basis": 74.20},
        {"ticker": "AAPL",  "name": "Apple Inc.",                              "asset_class": "us_stocks",   "shares": 50,    "avg_cost_basis": 142.80},
        {"ticker": "MSFT",  "name": "Microsoft Corp.",                         "asset_class": "us_stocks",   "shares": 20,    "avg_cost_basis": 280.50},
        {"ticker": "VMFXX", "name": "Vanguard Federal Money Market",           "asset_class": "cash",        "shares": 10032, "avg_cost_basis": 1.00,  "current_price": 1.00, "current_value": 10032.00},
    ]
    for h in holdings:
        # Real prices will be filled in by the PortfolioSyncAgent on its first run
        # or by hitting POST /api/holdings/sync-prices from the dashboard.
        h.setdefault("current_price", 0)
        h.setdefault("current_value", 0)
        db.table("holdings").insert({"user_id": DEMO_USER_ID, "goal_id": goal_id, **h}).execute()

print("Demo data seeded.")
print(f"  User:  {DEMO_USER_ID}")
print(f"  Goal:  {goal_id}")
print()
print("Next: hit POST /api/holdings/sync-prices (or the 'Sync Prices' button)")
print("to pull real prices from Yahoo Finance and create the first portfolio snapshot.")
print()
print("No fake alerts or fake rebalancing recommendations have been inserted —")
print("those are produced by the live agent pipeline only.")
