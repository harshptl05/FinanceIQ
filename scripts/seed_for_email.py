"""
Seed demo holdings + a retirement goal for whichever Supabase Auth user
matches the email you pass in.

Usage:
  python scripts/seed_for_email.py <email_substring>

We do a substring match because the user often only remembers part of
their email (e.g. "joshua.raja.654"). If exactly one user matches, we
seed for them. Otherwise we print the candidates.

Real prices come from POST /api/holdings/sync-prices (or the
"Sync Prices" button in the dashboard).
"""
import os
import sys
from datetime import date, timedelta
from dotenv import load_dotenv

load_dotenv()

if len(sys.argv) < 2:
    print("Usage: python scripts/seed_for_email.py <email_or_substring>")
    sys.exit(1)

needle = sys.argv[1].lower()

from supabase import create_client

db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

# List users via the Auth admin API (service-role key only).
# admin.list_users() paginates 50 per page; we'll grab the first few pages.
matches = []
page = 1
while True:
    resp = db.auth.admin.list_users(page=page, per_page=50)
    users = resp if isinstance(resp, list) else getattr(resp, "users", []) or []
    if not users:
        break
    for u in users:
        email = (getattr(u, "email", "") or "").lower()
        if needle in email:
            matches.append((u.id, email))
    if len(users) < 50:
        break
    page += 1

if not matches:
    print(f"No Supabase Auth user matched '{needle}'. Sign up at /login first.")
    sys.exit(2)

if len(matches) > 1:
    print(f"Multiple users matched '{needle}'. Be more specific:")
    for uid, em in matches:
        print(f"  {uid}  {em}")
    sys.exit(3)

user_id, email = matches[0]
print(f"Seeding for user {email}  ({user_id})")

# Profile
db.table("user_profiles").upsert({
    "id": user_id,
    "full_name": email.split("@")[0].replace(".", " ").title(),
    "risk_tolerance": "moderate",
    "risk_capacity": "medium",
}).execute()

# Goal — only insert if the user has none
existing_goals = db.table("goals").select("id").eq("user_id", user_id).execute()
if existing_goals.data:
    goal_id = existing_goals.data[0]["id"]
    print(f"  goal already exists: {goal_id}")
else:
    target_date = (date.today() + timedelta(days=365 * 22)).isoformat()
    goal = db.table("goals").insert({
        "user_id": user_id,
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
    print(f"  goal inserted: {goal_id}")

# Holdings — only insert if user has none
existing_holdings = db.table("holdings").select("id").eq("user_id", user_id).execute()
if existing_holdings.data:
    print(f"  holdings already exist ({len(existing_holdings.data)})")
else:
    holdings = [
        {"ticker": "VTI",   "name": "Vanguard Total Stock Market ETF",        "asset_class": "us_stocks",   "shares": 250,   "avg_cost_basis": 195.40},
        {"ticker": "VXUS",  "name": "Vanguard Total International Stock ETF", "asset_class": "intl_stocks", "shares": 400,   "avg_cost_basis": 52.30},
        {"ticker": "BND",   "name": "Vanguard Total Bond Market ETF",         "asset_class": "bonds",       "shares": 300,   "avg_cost_basis": 74.20},
        {"ticker": "AAPL",  "name": "Apple Inc.",                              "asset_class": "us_stocks",   "shares": 50,    "avg_cost_basis": 142.80},
        {"ticker": "MSFT",  "name": "Microsoft Corp.",                         "asset_class": "us_stocks",   "shares": 20,    "avg_cost_basis": 280.50},
        {"ticker": "VMFXX", "name": "Vanguard Federal Money Market",           "asset_class": "cash",        "shares": 10032, "avg_cost_basis": 1.00,  "current_price": 1.00, "current_value": 10032.00},
    ]
    for h in holdings:
        h.setdefault("current_price", 0)
        h.setdefault("current_value", 0)
        db.table("holdings").insert({"user_id": user_id, "goal_id": goal_id, **h}).execute()
    print(f"  holdings inserted ({len(holdings)})")

print()
print("Done. The dashboard should now show holdings.")
print("Click 'Sync prices' (header or Dashboard) to pull live yfinance prices.")
