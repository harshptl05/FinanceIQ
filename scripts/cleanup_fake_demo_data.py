"""
Wipe the hardcoded demo-time data that earlier versions of seed_demo.py
inserted into Supabase. Specifically:

  * the "Fed raised interest rates today" portfolio_alerts row
  * the matching pre-fabricated rebalancing_recommendations row
  * any portfolio_snapshots / recommendation_calibration rows that were
    seeded for the demo user (optional, behind --snapshots / --calibration)

Run once after pulling the latest code:

  python scripts/cleanup_fake_demo_data.py
  python scripts/cleanup_fake_demo_data.py --snapshots --calibration

Requires .env with SUPABASE_URL, SUPABASE_SERVICE_KEY, DEMO_USER_ID.
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()

DEMO_USER_ID = os.environ.get("DEMO_USER_ID", "")
if not DEMO_USER_ID:
    print("ERROR: DEMO_USER_ID not set in .env")
    sys.exit(1)

from supabase import create_client

db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

# --- Fake alerts ----------------------------------------------------------
# The old seed inserted an alert with the exact phrase "The Fed raised
# interest rates today." We delete any portfolio_alerts row for this user
# whose plain_english_explanation begins with that string OR that has no
# news_event_id (alerts produced by the real pipeline always link a
# news_events row).
alerts = (
    db.table("portfolio_alerts")
    .select("id, plain_english_explanation, news_event_id")
    .eq("user_id", DEMO_USER_ID)
    .execute()
    .data
    or []
)

deleted_alerts = 0
for a in alerts:
    txt = (a.get("plain_english_explanation") or "").lower()
    is_fake = (
        "the fed raised interest rates today" in txt
        or "fed raised rates today" in txt
        or a.get("news_event_id") is None
    )
    if is_fake:
        db.table("portfolio_alerts").delete().eq("id", a["id"]).execute()
        deleted_alerts += 1

print(f"Deleted {deleted_alerts} fake/orphaned portfolio_alerts row(s).")

# --- Fake rebalancing recommendations -------------------------------------
recs = (
    db.table("rebalancing_recommendations")
    .select("id, trigger_description, plain_english_explanation")
    .eq("user_id", DEMO_USER_ID)
    .execute()
    .data
    or []
)

FAKE_REC_PHRASES = (
    "us stocks drifted 4% above target",
    "your us stocks have grown to 64% of your portfolio",
)

deleted_recs = 0
for r in recs:
    blob = (
        (r.get("trigger_description") or "")
        + " "
        + (r.get("plain_english_explanation") or "")
    ).lower()
    if any(p in blob for p in FAKE_REC_PHRASES):
        db.table("rebalancing_recommendations").delete().eq("id", r["id"]).execute()
        deleted_recs += 1

print(f"Deleted {deleted_recs} fake rebalancing_recommendations row(s).")

if "--snapshots" in sys.argv:
    res = (
        db.table("portfolio_snapshots")
        .delete()
        .eq("user_id", DEMO_USER_ID)
        .execute()
    )
    print(f"Deleted all portfolio_snapshots for demo user (count = {len(res.data or [])}).")

if "--calibration" in sys.argv:
    res = (
        db.table("recommendation_calibration")
        .delete()
        .eq("user_id", DEMO_USER_ID)
        .execute()
    )
    print(f"Deleted all recommendation_calibration for demo user (count = {len(res.data or [])}).")

print("Done. Re-run portfolio_sync (or POST /api/holdings/sync-prices) to populate real data.")
