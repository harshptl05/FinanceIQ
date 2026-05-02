import json
import re
from datetime import date, datetime, timezone

import anthropic
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from core.config import settings
from core.database import get_db
from data.market_data import get_price
from financial.rebalance_apply import (
    build_strategy_rationale,
    plan_rebalance_updates,
)
from financial.rebalancing_math import calculate_current_allocation, generate_recommendation

router = APIRouter()

CLAUDE_MODEL = "claude-sonnet-4-20250514"

DEFAULT_TICKER_BY_CLASS = {
    "us_stocks": "VTI",
    "intl_stocks": "VXUS",
    "bonds": "BND",
    "cash": "VMFXX",
    "real_estate": "VNQ",
    "commodities": "GLD",
    "other": "VTI",
}

# Friendly names when we synthesize a holding row during apply.
_INSERT_HOLDING_DISPLAY_NAMES = {
    "VMFXX": "Vanguard Federal Money Market",
    "VMMXX": "Vanguard Treasury Money Market",
    "VUSXX": "Vanguard Treasury Money Market (Admiral)",
    "VTI": "Vanguard Total Stock Market ETF",
    "VXUS": "Vanguard Total International Stock ETF",
    "BND": "Vanguard Total Bond Market ETF",
    "VNQ": "Vanguard Real Estate ETF",
    "GLD": "SPDR Gold Shares",
}

INSTRUCTION_PROMPT = """You are helping an everyday investor execute rebalancing trades in their brokerage account.

RECOMMENDED TRADES:
{trades_json}

USER PORTFOLIO CONTEXT:
{portfolio_context}

For each trade, write clear step-by-step instructions a non-investor can follow in any standard brokerage (Fidelity, Vanguard, Schwab, etc.).

Respond with ONLY a JSON array, no other text:
[
  {{
    "ticker": "BND",
    "name": "Vanguard Total Bond Market ETF",
    "action": "buy",
    "amount_dollars": 23079.64,
    "steps": [
      "Log into your brokerage account",
      "Search for 'BND' or 'Vanguard Total Bond Market ETF' in the search bar",
      "Click 'Trade' or 'Buy'",
      "Select 'Dollar amount' instead of 'Number of shares'",
      "Enter $23,079.64 as the amount",
      "Select 'Market order' for the order type",
      "Review the order and confirm"
    ],
    "plain_english_why": "Buying bonds brings your portfolio back to your target allocation and reduces your overall risk as you approach your retirement goal.",
    "timing_note": "Best executed during market hours (9:30am - 4pm EST Monday-Friday)",
    "mutual_fund_note": null
  }}
]

Rules:
- Steps must be specific and actionable for any major brokerage
- plain_english_why must reference their specific goal, never generic advice
- If the holding is a mutual_fund, set mutual_fund_note to: 'This is a mutual fund — your order will execute at the end-of-day NAV price (4pm EST), not immediately'
- Never use jargon without explaining it
- Keep steps to 5-7 maximum per trade"""


def _get_user_id(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    db = get_db()
    try:
        return db.auth.get_user(token).user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


class StatusUpdate(BaseModel):
    status: str
    remind_at: str | None = None


def _extract_json_array(text: str) -> list:
    raw = text.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-zA-Z]*\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    return json.loads(raw)


def _enrich_trades_for_prompt(trades: list, holdings: list, goal_name: str) -> list:
    out = []
    for t in trades:
        ac = t.get("asset_class")
        ticker = (t.get("ticker") or "").strip().upper() or None
        if not ticker:
            ticker = DEFAULT_TICKER_BY_CLASS.get(ac or "", "VTI")
        name = ticker
        for h in holdings:
            if (ticker and h.get("ticker") == ticker) or (
                ac and h.get("asset_class") == ac
            ):
                name = h.get("name") or h.get("ticker") or ticker
                break
        row = {
            "ticker": ticker,
            "name": name,
            "action": t.get("action"),
            "amount_dollars": float(t.get("amount") or 0),
            "asset_class": ac,
            "reason": t.get("reason"),
            "goal_name": goal_name,
        }
        if holdings:
            for h in holdings:
                if h.get("ticker") == ticker:
                    row["is_mutual_fund"] = bool(h.get("is_mutual_fund"))
                    break
        out.append(row)
    return out


def _build_portfolio_context(
    goal: dict | None,
    holdings: list,
    profile: dict | None,
    total_value: float,
) -> dict:
    ctx = {
        "total_portfolio_value": round(total_value, 2),
        "goal_name": goal.get("goal_name") if goal else None,
        "goal_type": goal.get("goal_type") if goal else None,
        "rebalancing_strategy": goal.get("rebalancing_strategy") if goal else None,
        "rebalancing_threshold": goal.get("rebalancing_threshold") if goal else None,
        "rebalancing_frequency": goal.get("rebalancing_frequency") if goal else None,
        "account_type": goal.get("account_type") if goal else None,
        "risk_tolerance": profile.get("risk_tolerance") if profile else None,
        "primary_holdings": [
            {
                "ticker": h.get("ticker"),
                "name": h.get("name"),
                "asset_class": h.get("asset_class"),
                "current_value": float(h.get("current_value") or 0),
                "is_mutual_fund": bool(h.get("is_mutual_fund")),
            }
            for h in holdings[:12]
        ],
    }
    return ctx


@router.get("/recommendations")
def get_recommendations(authorization: str | None = Header(default=None)):
    user_id = _get_user_id(authorization)
    db = get_db()
    resp = (
        db.table("rebalancing_recommendations")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "pending")
        .order("created_at", desc=True)
        .execute()
    )
    recs = resp.data or []

    if recs:
        goal_ids = list({r["goal_id"] for r in recs if r.get("goal_id")})
        if goal_ids:
            goals_resp = (
                db.table("goals")
                .select("id, goal_name")
                .in_("id", goal_ids)
                .execute()
            )
            name_by_id = {g["id"]: g["goal_name"] for g in (goals_resp.data or [])}
            for r in recs:
                r["goal_name"] = name_by_id.get(r.get("goal_id"))

    return {"recommendations": recs}


@router.post("/trigger")
def trigger_rebalancing(authorization: str | None = Header(default=None)):
    user_id = _get_user_id(authorization)
    db = get_db()

    holdings_resp = db.table("holdings").select("*").eq("user_id", user_id).execute()
    goals_resp = db.table("goals").select("*").eq("user_id", user_id).execute()
    profile_resp = db.table("user_profiles").select("*").eq("id", user_id).execute()

    goals = goals_resp.data or []
    holdings = holdings_resp.data or []
    profile = profile_resp.data[0] if profile_resp.data else {}
    total_value = sum(float(h.get("current_value", 0)) for h in holdings)

    user_data = {
        "full_name": profile.get("full_name", ""),
        "holdings": holdings,
        "goals": goals,
        "portfolio_value": total_value,
    }

    persisted = []
    skipped = 0
    for goal in goals:
        rec = generate_recommendation(user_data, goal["id"])
        if not rec.get("needs_rebalancing"):
            skipped += 1
            continue

        existing = (
            db.table("rebalancing_recommendations")
            .select("id")
            .eq("user_id", user_id)
            .eq("goal_id", goal["id"])
            .eq("status", "pending")
            .execute()
        )
        if existing.data:
            persisted.append(existing.data[0])
            continue

        ASSET_LABELS = {
            "us_stocks": "US stocks",
            "intl_stocks": "Intl stocks",
            "bonds": "Bonds",
            "cash": "Cash",
            "real_estate": "Real estate",
            "commodities": "Commodities",
            "other": "Other",
        }

        drift_parts = []
        for k, v in (rec.get("drift") or {}).items():
            if abs(v) <= 0.01:
                continue
            label = ASSET_LABELS.get(k, k.replace("_", " ").title())
            sign = "+" if v > 0 else ""
            drift_parts.append(f"{label} {sign}{round(v * 100, 1)}%")
        drift_summary = ", ".join(drift_parts)

        plain = (
            f"Your {goal.get('goal_name', 'portfolio')} has drifted from target — "
            f"{drift_summary}."
            if drift_summary
            else "A rebalancing opportunity was detected."
        )

        payload = {
            "user_id": user_id,
            "goal_id": goal["id"],
            "trigger_type": "drift",
            "trigger_description": "Manual re-check",
            "current_allocation": rec.get("current_allocation"),
            "target_allocation": rec.get("target_allocation"),
            "recommended_trades": rec.get("recommended_trades"),
            "urgency": rec.get("urgency"),
            "plain_english_explanation": plain,
            "tax_loss_harvesting_opportunity": bool(rec.get("tax_loss_harvesting")),
            "tax_notes": (
                "; ".join(t["note"] for t in rec.get("tax_loss_harvesting", []))
                or None
            ),
            "status": "pending",
        }
        inserted = db.table("rebalancing_recommendations").insert(payload).execute()
        if inserted.data:
            persisted.append(inserted.data[0])

    return {
        "created": len(persisted),
        "skipped": skipped,
        "recommendations": persisted,
    }


@router.put("/{rec_id}/status")
def update_recommendation_status(
    rec_id: str, body: StatusUpdate, authorization: str | None = Header(default=None)
):
    user_id = _get_user_id(authorization)
    db = get_db()
    payload = body.model_dump(exclude_unset=True)
    resp = (
        db.table("rebalancing_recommendations")
        .update(payload)
        .eq("id", rec_id)
        .eq("user_id", user_id)
        .execute()
    )
    return resp.data[0] if resp.data else {}


@router.post("/{rec_id}/generate-instructions")
def generate_trade_instructions(
    rec_id: str, authorization: str | None = Header(default=None)
):
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=503, detail="AI instructions unavailable")

    user_id = _get_user_id(authorization)
    db = get_db()
    rec_resp = (
        db.table("rebalancing_recommendations")
        .select("*")
        .eq("id", rec_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not rec_resp.data:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    rec = rec_resp.data[0]

    trades = rec.get("recommended_trades") or []
    if isinstance(trades, str):
        trades = json.loads(trades)

    holdings_resp = db.table("holdings").select("*").eq("user_id", user_id).execute()
    holdings = holdings_resp.data or []

    goal = None
    if rec.get("goal_id"):
        g_resp = (
            db.table("goals").select("*").eq("id", rec["goal_id"]).execute()
        )
        goal = (g_resp.data or [None])[0]

    profile_resp = db.table("user_profiles").select("*").eq("id", user_id).execute()
    profile = profile_resp.data[0] if profile_resp.data else {}

    total_value = sum(float(h.get("current_value", 0)) for h in holdings)
    goal_name = goal.get("goal_name") if goal else "your portfolio"

    enriched = _enrich_trades_for_prompt(trades, holdings, goal_name)
    portfolio_context = json.dumps(
        _build_portfolio_context(goal, holdings, profile, total_value), indent=2
    )
    trades_json = json.dumps(enriched, indent=2)

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    msg = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=8192,
        messages=[
            {
                "role": "user",
                "content": INSTRUCTION_PROMPT.format(
                    trades_json=trades_json, portfolio_context=portfolio_context
                ),
            }
        ],
    )
    text = msg.content[0].text
    try:
        instructions = _extract_json_array(text)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Could not parse AI response as JSON: {e}",
        ) from e

    db.table("rebalancing_recommendations").update(
        {"trade_instructions": instructions}
    ).eq("id", rec_id).eq("user_id", user_id).execute()

    return {"instructions": instructions}


@router.post("/{rec_id}/apply")
async def apply_rebalanced_allocation(
    rec_id: str, authorization: str | None = Header(default=None)
):
    user_id = _get_user_id(authorization)
    db = get_db()

    rec_resp = (
        db.table("rebalancing_recommendations")
        .select("*")
        .eq("id", rec_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not rec_resp.data:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    rec = rec_resp.data[0]

    ta = rec.get("target_allocation") or {}
    if isinstance(ta, str):
        ta = json.loads(ta)
    if not ta:
        raise HTTPException(status_code=400, detail="No target allocation on recommendation")

    goal_id = rec.get("goal_id")
    holdings_resp = db.table("holdings").select("*").eq("user_id", user_id).execute()
    holdings = holdings_resp.data or []

    updates, inserts = plan_rebalance_updates(holdings, ta, goal_id)

    now_iso = datetime.now(timezone.utc).isoformat()

    # Track every executed trade so the UI can show "we did X for you"
    # instead of just a generic "done" toast. Each entry mirrors the
    # rec.recommended_trades shape so the frontend can reuse its renderer.
    executed_trades: list[dict] = []

    # Map current-holdings by id so we can compute the dollar delta of
    # each update (post-shares × price minus prior current_value).
    holding_by_id = {h["id"]: h for h in holdings}

    for u in updates:
        uid = u["id"]
        prior = holding_by_id.get(uid) or {}
        prior_value = float(prior.get("current_value") or 0)
        new_value = float(u["current_value"])
        delta = new_value - prior_value
        payload = {
            "shares": u["shares"],
            "current_value": new_value,
            "last_updated": now_iso,
        }
        if u.get("current_price"):
            payload["current_price"] = u["current_price"]
        db.table("holdings").update(payload).eq("id", uid).eq("user_id", user_id).execute()
        if abs(delta) >= 1.0:
            executed_trades.append(
                {
                    "ticker": prior.get("ticker"),
                    "asset_class": prior.get("asset_class"),
                    "action": "buy" if delta > 0 else "sell",
                    "amount": round(abs(delta), 2),
                }
            )

    for ins in inserts:
        ticker = ins["ticker"].upper()
        target_val = float(ins["target_value"])
        price = float(await get_price(ticker) or 0)
        if price <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"Could not price {ticker} for simulated rebalance.",
            )
        shares = target_val / price
        insert_payload = {
            "user_id": user_id,
            "ticker": ticker,
            "name": _INSERT_HOLDING_DISPLAY_NAMES.get(ticker, ticker),
            "asset_class": ins["asset_class"],
            "shares": round(shares, 6),
            "avg_cost_basis": round(price, 4),
            "current_price": round(price, 4),
            "current_value": round(shares * price, 2),
            "goal_id": ins.get("goal_id"),
            "last_updated": now_iso,
        }
        try:
            db.table("holdings").insert(insert_payload).execute()
        except Exception:
            insert_payload.pop("goal_id", None)
            db.table("holdings").insert(insert_payload).execute()
        executed_trades.append(
            {
                "ticker": ticker,
                "asset_class": ins["asset_class"],
                "action": "buy",
                "amount": round(shares * price, 2),
            }
        )

    holdings_resp2 = db.table("holdings").select("*").eq("user_id", user_id).execute()
    holdings2 = holdings_resp2.data or []

    dead_ids = [
        h["id"]
        for h in holdings2
        if float(h.get("current_value") or 0) <= 0.01
        and float(h.get("shares") or 0) <= 1e-6
    ]
    for hid in dead_ids:
        db.table("holdings").delete().eq("id", hid).eq("user_id", user_id).execute()

    holdings_resp3 = db.table("holdings").select("*").eq("user_id", user_id).execute()
    holdings3 = holdings_resp3.data or []
    total_value = sum(float(h.get("current_value", 0)) for h in holdings3)
    allocation = calculate_current_allocation(holdings3)

    db.table("portfolio_snapshots").insert(
        {
            "user_id": user_id,
            "total_value": round(total_value, 2),
            "allocation": allocation,
            "snapshot_date": date.today().isoformat(),
        }
    ).execute()

    goal = None
    if goal_id:
        g_resp = db.table("goals").select("*").eq("id", goal_id).execute()
        goal = (g_resp.data or [None])[0]

    strategy_note = build_strategy_rationale(goal)

    db.table("rebalancing_recommendations").update({"status": "acted"}).eq(
        "id", rec_id
    ).eq("user_id", user_id).execute()

    return {
        "status": "acted",
        "total_value": round(total_value, 2),
        "allocation": allocation,
        "strategy_note": strategy_note,
        "updated_holdings": len(updates) + len(inserts),
        "executed_trades": executed_trades,
    }


@router.get("/calibration/stats")
def calibration_stats(authorization: str | None = Header(default=None)):
    user_id = _get_user_id(authorization)
    db = get_db()
    resp = (
        db.table("recommendation_calibration")
        .select("recommendation_was_correct")
        .eq("user_id", user_id)
        .execute()
    )
    rows = resp.data or []
    total = len(rows)
    correct = sum(1 for r in rows if r.get("recommendation_was_correct"))
    accuracy = round(correct / total * 100, 1) if total > 0 else None
    return {"total_evaluated": total, "correct": correct, "accuracy_pct": accuracy}
