"""Quick helper: run portfolio_sync.sync_user_holdings + one news cycle
for whichever user matches the email substring you pass in. Lets us trigger
the same actions the UI buttons do, but server-side, in one shot.

Usage:
  python scripts/sync_for_email.py <email_or_substring>
"""
import os
import sys
import asyncio
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
load_dotenv()

if len(sys.argv) < 2:
    print("Usage: python scripts/sync_for_email.py <email_or_substring>")
    sys.exit(1)

needle = sys.argv[1].lower()

from supabase import create_client
db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

# Find the user
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
    print(f"No user matched '{needle}'")
    sys.exit(2)
if len(matches) > 1:
    print("Multiple matches:")
    for uid, em in matches:
        print(f"  {uid}  {em}")
    sys.exit(3)

user_id, email = matches[0]
print(f"Working on {email} ({user_id})")


async def main():
    from agents.portfolio_sync import sync_user_holdings
    print("→ syncing prices from yfinance...")
    await sync_user_holdings(user_id)
    print("✓ prices synced")

    print("→ pulling one round of live news + classification...")
    import agents.news_ingestion as news_agent
    import agents.classifier as classifier
    if news_agent._on_new_event is None:
        from agents.orchestrator import on_news_event, on_classified
        news_agent.set_callback(on_news_event)
        classifier.set_callback(on_classified)
    res = await news_agent.fetch_and_process_once()
    print(f"✓ news done: {res}")

    # Show the result
    holdings = db.table("holdings").select("ticker, current_price, current_value").eq("user_id", user_id).execute().data or []
    total = sum(float(h.get("current_value") or 0) for h in holdings)
    print()
    print(f"Portfolio total: ${total:,.2f}")
    for h in holdings:
        print(f"  {h['ticker']:6s}  ${float(h.get('current_price') or 0):,.2f}  → ${float(h.get('current_value') or 0):,.2f}")


asyncio.run(main())
