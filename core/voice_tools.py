"""
Voice agent tools — the action layer Deepgram's Voice Agent calls into.

Every tool in this module:
  - Takes a `user_id` (resolved server-side from the Supabase JWT, never trusted from the client).
  - Returns a JSON-safe dict that the agent will read back to the user.
  - Catches its own exceptions and returns a {"error": "..."} payload so the
    LLM can gracefully recover and tell the user what happened, rather than
    crashing the WebSocket.

The function schemas at the bottom of the file are the canonical source of
truth — both the agent settings frame AND the dispatcher import them.
"""

from __future__ import annotations

import asyncio
from datetime import date, datetime, timezone
from typing import Any, Awaitable, Callable

from core.database import get_db
from data.fund_data import get_fund_metadata_sync, is_mutual_fund
from data.market_data import get_price
from financial.glide_path import get_target_allocation
from financial.rebalance_apply import build_strategy_rationale, plan_rebalance_updates
from financial.rebalancing_math import (
    calculate_current_allocation,
    generate_recommendation,
)
from financial.scenario_data import SCENARIOS, run_scenario


# Tabs the voice agent can navigate to. Must match the tab IDs in app/page.tsx.
NAVIGABLE_TABS = {"dashboard", "investment", "rebalance", "activity", "goals", "ai"}

VALID_RISK_TOLERANCE = {"conservative", "moderate", "aggressive"}
VALID_RISK_CAPACITY = {"low", "medium", "high"}


# ---------------------------------------------------------------------------
# Read-only tools
# ---------------------------------------------------------------------------


async def tool_get_portfolio_summary(user_id: str, args: dict[str, Any]) -> dict:
    db = get_db()
    holdings = (
        db.table("holdings").select("*").eq("user_id", user_id).execute().data or []
    )
    goals = db.table("goals").select("*").eq("user_id", user_id).execute().data or []

    total_value = sum(float(h.get("current_value") or 0) for h in holdings)
    allocation = calculate_current_allocation(holdings)
    target = (goals[0].get("target_allocation") if goals else {}) or {}
    drift = {
        k: round(allocation.get(k, 0) - target.get(k, 0), 4)
        for k in set(list(allocation.keys()) + list(target.keys()))
    }

    return {
        "total_value": round(total_value, 2),
        "current_allocation": {k: round(v, 4) for k, v in allocation.items()},
        "target_allocation": target,
        "drift": drift,
        "holdings_count": len(holdings),
        "goals_count": len(goals),
    }


async def tool_get_holdings(user_id: str, args: dict[str, Any]) -> dict:
    db = get_db()
    holdings = (
        db.table("holdings").select("*").eq("user_id", user_id).execute().data or []
    )
    return {
        "holdings": [
            {
                "ticker": h.get("ticker"),
                "name": h.get("name"),
                "asset_class": h.get("asset_class"),
                "shares": float(h.get("shares") or 0),
                "current_price": float(h.get("current_price") or 0),
                "current_value": float(h.get("current_value") or 0),
            }
            for h in sorted(
                holdings,
                key=lambda h: float(h.get("current_value") or 0),
                reverse=True,
            )
        ]
    }


async def tool_list_goals(user_id: str, args: dict[str, Any]) -> dict:
    db = get_db()
    goals = db.table("goals").select("*").eq("user_id", user_id).execute().data or []
    today = date.today()
    out = []
    for g in goals:
        td_str = (g.get("target_date") or "")[:10]
        years = None
        if td_str:
            try:
                years = round(
                    (datetime.strptime(td_str, "%Y-%m-%d").date() - today).days / 365.25,
                    1,
                )
            except Exception:
                years = None
        out.append(
            {
                "id": g["id"],
                "name": g.get("goal_name"),
                "type": g.get("goal_type"),
                "target_date": td_str,
                "target_amount": float(g.get("target_amount") or 0),
                "current_amount": float(g.get("current_amount") or 0),
                "years_to_goal": years,
            }
        )
    return {"goals": out}


async def tool_get_goal_progress(user_id: str, args: dict[str, Any]) -> dict:
    db = get_db()
    name = (args or {}).get("goal_name", "").strip().lower()
    goals = db.table("goals").select("*").eq("user_id", user_id).execute().data or []
    if not goals:
        return {"error": "You haven't set up any goals yet."}
    goal = _match_goal(goals, name)
    if not goal:
        return {"error": f"I couldn't find a goal called '{name}'."}

    target = float(goal.get("target_amount") or 0)
    current = float(goal.get("current_amount") or 0)
    pct = round(current / target * 100, 1) if target > 0 else None
    td = (goal.get("target_date") or "")[:10]
    years = None
    if td:
        try:
            years = round(
                (datetime.strptime(td, "%Y-%m-%d").date() - date.today()).days / 365.25,
                1,
            )
        except Exception:
            years = None
    return {
        "goal_name": goal.get("goal_name"),
        "target_amount": target,
        "current_amount": current,
        "progress_pct": pct,
        "years_to_goal": years,
    }


async def tool_run_scenario(user_id: str, args: dict[str, Any]) -> dict:
    key = (args or {}).get("scenario_key") or ""
    if key not in SCENARIOS:
        return {"error": f"Unknown scenario. Available: {', '.join(SCENARIOS.keys())}"}
    db = get_db()
    holdings = (
        db.table("holdings").select("*").eq("user_id", user_id).execute().data or []
    )
    if not holdings:
        return {"error": "You don't have any holdings to run a scenario against."}
    result = run_scenario(holdings, key)
    if "error" in result:
        return result
    return {
        "scenario": result["scenario"],
        "before": round(result["total_portfolio_before"], 2),
        "after": round(result["total_portfolio_after"], 2),
        "dollar_impact": round(result["total_dollar_impact"], 2),
        "pct_impact": round(result["total_pct_impact"], 2),
        "duration_months": result["duration_months"],
        "plain_english": result["plain_english"],
    }


async def tool_get_recent_alerts(user_id: str, args: dict[str, Any]) -> dict:
    db = get_db()
    limit = int((args or {}).get("limit", 5))
    rows = (
        db.table("portfolio_alerts")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data
        or []
    )
    return {
        "alerts": [
            {
                "id": r["id"],
                "impact": r.get("impact_classification"),
                "urgency": r.get("urgency"),
                "explanation": r.get("plain_english_explanation"),
                "read": bool(r.get("read")),
                "created_at": r.get("created_at"),
            }
            for r in rows
        ]
    }


# ---------------------------------------------------------------------------
# Action tools — actually mutate the user's portfolio
# ---------------------------------------------------------------------------


async def tool_rebalance_portfolio(user_id: str, args: dict[str, Any]) -> dict:
    """End-to-end: detect drift → apply target allocation → persist snapshot.

    This is the headline action. The voice agent calls this when the user
    says something like 'rebalance my portfolio', and we move the actual
    holdings to match the target allocation, just like the Rebalance tab's
    "Rebalance for me" button does.
    """
    db = get_db()
    holdings = (
        db.table("holdings").select("*").eq("user_id", user_id).execute().data or []
    )
    goals = db.table("goals").select("*").eq("user_id", user_id).execute().data or []

    if not holdings:
        return {"error": "You don't have any holdings to rebalance yet."}
    if not goals:
        return {
            "error": "You need at least one goal so I know what to rebalance toward."
        }

    goal_name = (args or {}).get("goal_name")
    goal = _match_goal(goals, (goal_name or "").lower()) if goal_name else goals[0]
    if not goal:
        return {"error": f"I couldn't find a goal called '{goal_name}'."}

    total_value = sum(float(h.get("current_value") or 0) for h in holdings)
    user_data = {
        "holdings": holdings,
        "goals": goals,
        "portfolio_value": total_value,
    }
    rec = generate_recommendation(user_data, goal["id"])
    if not rec.get("needs_rebalancing"):
        return {
            "status": "already_balanced",
            "message": (
                f"Your {goal['goal_name']} portfolio is already within its rebalancing band. "
                "Nothing to do right now."
            ),
        }

    target_alloc = rec.get("target_allocation") or goal.get("target_allocation") or {}
    if not target_alloc:
        return {"error": "No target allocation was found for this goal."}

    updates, inserts = plan_rebalance_updates(holdings, target_alloc, goal["id"])
    now_iso = datetime.now(timezone.utc).isoformat()

    for u in updates:
        payload = {
            "shares": u["shares"],
            "current_value": u["current_value"],
            "last_updated": now_iso,
        }
        if u.get("current_price"):
            payload["current_price"] = u["current_price"]
        db.table("holdings").update(payload).eq("id", u["id"]).eq(
            "user_id", user_id
        ).execute()

    for ins in inserts:
        ticker = ins["ticker"].upper()
        target_val = float(ins["target_value"])
        try:
            price = float((await get_price(ticker)) or 0)
        except Exception:
            price = 0.0
        if price <= 0:
            return {
                "error": f"Could not price {ticker} — try again in a minute.",
            }
        shares = target_val / price
        insert_payload = {
            "user_id": user_id,
            "ticker": ticker,
            "name": ticker,
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

    holdings2 = (
        db.table("holdings").select("*").eq("user_id", user_id).execute().data or []
    )
    dead = [
        h["id"]
        for h in holdings2
        if float(h.get("current_value") or 0) <= 0.01
        and float(h.get("shares") or 0) <= 1e-6
    ]
    for hid in dead:
        db.table("holdings").delete().eq("id", hid).eq("user_id", user_id).execute()

    holdings3 = (
        db.table("holdings").select("*").eq("user_id", user_id).execute().data or []
    )
    new_total = sum(float(h.get("current_value") or 0) for h in holdings3)
    new_alloc = calculate_current_allocation(holdings3)

    db.table("portfolio_snapshots").insert(
        {
            "user_id": user_id,
            "total_value": round(new_total, 2),
            "allocation": new_alloc,
            "snapshot_date": date.today().isoformat(),
        }
    ).execute()

    # Mark any pending recommendation for this goal as acted so the
    # Rebalance tab reflects the change next render.
    db.table("rebalancing_recommendations").update({"status": "acted"}).eq(
        "user_id", user_id
    ).eq("goal_id", goal["id"]).eq("status", "pending").execute()

    rationale = build_strategy_rationale(goal)

    return {
        "status": "rebalanced",
        "goal_name": goal["goal_name"],
        "total_value": round(new_total, 2),
        "new_allocation": {k: round(v, 4) for k, v in new_alloc.items()},
        "trades_executed": len(updates) + len(inserts),
        "strategy_rationale": rationale,
    }


async def tool_contribute_to_goal(user_id: str, args: dict[str, Any]) -> dict:
    db = get_db()
    name = ((args or {}).get("goal_name") or "").strip().lower()
    amount = float((args or {}).get("amount") or 0)
    if amount <= 0:
        return {"error": "Contribution amount must be greater than zero."}
    goals = db.table("goals").select("*").eq("user_id", user_id).execute().data or []
    if not goals:
        return {"error": "No goals found."}
    goal = _match_goal(goals, name)
    if not goal:
        return {"error": f"Couldn't find a goal called '{name}'."}

    new_amount = float(goal.get("current_amount") or 0) + amount
    db.table("goals").update({"current_amount": round(new_amount, 2)}).eq(
        "id", goal["id"]
    ).eq("user_id", user_id).execute()
    return {
        "status": "contributed",
        "goal_name": goal["goal_name"],
        "added": amount,
        "new_total": round(new_amount, 2),
    }


async def tool_create_goal(user_id: str, args: dict[str, Any]) -> dict:
    name = ((args or {}).get("goal_name") or "").strip()
    gtype = ((args or {}).get("goal_type") or "other").strip().lower()
    target_date = ((args or {}).get("target_date") or "").strip()
    target_amount = (args or {}).get("target_amount")
    if not name:
        return {"error": "Please provide a goal name."}
    if not target_date:
        return {"error": "Please provide a target date in YYYY-MM-DD format."}

    try:
        td = datetime.strptime(target_date[:10], "%Y-%m-%d").date()
    except Exception:
        return {"error": "I couldn't parse the target date — use YYYY-MM-DD."}

    years = max((td - date.today()).days / 365.25, 0)
    target_alloc = get_target_allocation(gtype, years)

    payload = {
        "user_id": user_id,
        "goal_type": gtype,
        "goal_name": name,
        "target_date": td.isoformat(),
        "target_amount": float(target_amount) if target_amount else None,
        "current_amount": 0,
        "target_allocation": target_alloc,
        "rebalancing_strategy": "hybrid",
        "rebalancing_threshold": 0.05,
        "rebalancing_frequency": "quarterly",
        "account_type": "taxable",
    }
    resp = get_db().table("goals").insert(payload).execute()
    return {"status": "created", "goal": resp.data[0] if resp.data else payload}


async def tool_mark_alerts_read(user_id: str, args: dict[str, Any]) -> dict:
    db = get_db()
    db.table("portfolio_alerts").update({"read": True}).eq(
        "user_id", user_id
    ).eq("read", False).execute()
    return {"status": "marked_read"}


# ---------------------------------------------------------------------------
# Trade tools — buy / sell / sync (mirrors api/holdings.py:trade)
# ---------------------------------------------------------------------------


async def tool_buy_holding(user_id: str, args: dict[str, Any]) -> dict:
    return await _trade(user_id, args or {}, action="buy")


async def tool_sell_holding(user_id: str, args: dict[str, Any]) -> dict:
    return await _trade(user_id, args or {}, action="sell")


async def _trade(user_id: str, args: dict[str, Any], *, action: str) -> dict:
    """Server-side mirror of api/holdings.py:trade — keeps the voice agent
    and the click-driven UI in lockstep so trades behave identically."""
    db = get_db()
    ticker = (args.get("ticker") or "").upper().strip()
    if not ticker:
        return {"error": "Please tell me which ticker to trade."}

    shares_in = args.get("shares")
    dollars_in = args.get("amount_dollars") or args.get("dollars")

    existing = (
        db.table("holdings")
        .select("*")
        .eq("user_id", user_id)
        .eq("ticker", ticker)
        .execute()
    )
    holding = (existing.data or [None])[0]

    try:
        price = float((await get_price(ticker)) or 0)
    except Exception:
        price = 0.0
    if price <= 0 and holding:
        price = float(holding.get("current_price") or 0)
    if price <= 0:
        return {
            "error": (
                f"I couldn't get a current price for {ticker}. "
                "Yahoo may be rate-limiting — try again in a minute."
            )
        }

    if shares_in is None and dollars_in is None:
        return {
            "error": (
                "I need either a number of shares or a dollar amount to trade."
            )
        }
    shares = float(shares_in) if shares_in is not None else float(dollars_in) / price
    if shares <= 0:
        return {"error": "Trade size must be greater than zero."}

    now_iso = datetime.now(timezone.utc).isoformat()

    if action == "buy":
        if holding:
            old_shares = float(holding.get("shares") or 0)
            old_cost = float(holding.get("avg_cost_basis") or 0)
            new_shares = old_shares + shares
            new_cost = (
                ((old_shares * old_cost) + (shares * price)) / new_shares
                if new_shares > 0
                else price
            )
            db.table("holdings").update(
                {
                    "shares": new_shares,
                    "avg_cost_basis": new_cost,
                    "current_price": price,
                    "current_value": round(new_shares * price, 2),
                    "last_updated": now_iso,
                }
            ).eq("id", holding["id"]).eq("user_id", user_id).execute()
            return {
                "status": "bought",
                "ticker": ticker,
                "shares": round(shares, 6),
                "price": round(price, 4),
                "total_cost": round(shares * price, 2),
                "new_position_shares": round(new_shares, 6),
                "new_position_value": round(new_shares * price, 2),
            }
        # Brand-new position
        asset_class = args.get("asset_class") or "us_stocks"
        payload: dict[str, Any] = {
            "user_id": user_id,
            "ticker": ticker,
            "name": args.get("name") or ticker,
            "asset_class": asset_class,
            "shares": shares,
            "avg_cost_basis": price,
            "current_price": price,
            "current_value": round(shares * price, 2),
            "last_updated": now_iso,
        }
        try:
            if is_mutual_fund(ticker, asset_class):
                meta = get_fund_metadata_sync(ticker)
                payload["is_mutual_fund"] = True
                if meta.get("expense_ratio") is not None:
                    payload["expense_ratio"] = meta["expense_ratio"]
        except Exception:
            pass
        try:
            db.table("holdings").insert(payload).execute()
        except Exception:
            for k in ("is_mutual_fund", "expense_ratio", "nav_date"):
                payload.pop(k, None)
            db.table("holdings").insert(payload).execute()
        return {
            "status": "bought",
            "ticker": ticker,
            "shares": round(shares, 6),
            "price": round(price, 4),
            "total_cost": round(shares * price, 2),
            "new_position_shares": round(shares, 6),
            "new_position_value": round(shares * price, 2),
        }

    # ---- sell ----
    if not holding:
        return {"error": f"You don't own any {ticker} right now."}
    old_shares = float(holding.get("shares") or 0)
    if shares > old_shares + 1e-6:
        return {
            "error": f"You only own {old_shares:g} shares of {ticker} — can't sell {shares:g}."
        }
    new_shares = max(0.0, old_shares - shares)
    if new_shares < 1e-6:
        db.table("holdings").delete().eq("id", holding["id"]).eq(
            "user_id", user_id
        ).execute()
        return {
            "status": "sold",
            "ticker": ticker,
            "shares": round(shares, 6),
            "price": round(price, 4),
            "proceeds": round(shares * price, 2),
            "position_closed": True,
        }
    db.table("holdings").update(
        {
            "shares": new_shares,
            "current_price": price,
            "current_value": round(new_shares * price, 2),
            "last_updated": now_iso,
        }
    ).eq("id", holding["id"]).eq("user_id", user_id).execute()
    return {
        "status": "sold",
        "ticker": ticker,
        "shares": round(shares, 6),
        "price": round(price, 4),
        "proceeds": round(shares * price, 2),
        "remaining_shares": round(new_shares, 6),
    }


async def tool_sync_prices(user_id: str, args: dict[str, Any]) -> dict:
    """Pull live prices for every holding the user owns."""
    from agents.portfolio_sync import sync_user_holdings

    try:
        await sync_user_holdings(user_id)
    except Exception as e:
        return {"error": f"Sync failed: {e}"}
    db = get_db()
    holdings = (
        db.table("holdings").select("current_value").eq("user_id", user_id).execute().data
        or []
    )
    total = sum(float(h.get("current_value") or 0) for h in holdings)
    return {"status": "synced", "new_total_value": round(total, 2)}


async def tool_refresh_news(user_id: str, args: dict[str, Any]) -> dict:
    """Trigger one news ingestion + classification pass for this user."""
    try:
        from agents import news_ingestion as news_agent

        result = await news_agent.fetch_and_process_once(background_classify=False)
    except Exception as e:
        return {"error": f"News refresh failed: {e}"}
    return {
        "status": "refreshed",
        "new_events": (result or {}).get("new_events", 0),
    }


# ---------------------------------------------------------------------------
# Profile + UI tools
# ---------------------------------------------------------------------------


async def tool_update_profile(user_id: str, args: dict[str, Any]) -> dict:
    db = get_db()
    payload: dict[str, Any] = {}
    if (args or {}).get("full_name"):
        payload["full_name"] = str(args["full_name"]).strip()
    if (args or {}).get("risk_tolerance"):
        rt = str(args["risk_tolerance"]).lower().strip()
        if rt not in VALID_RISK_TOLERANCE:
            return {
                "error": f"risk_tolerance must be one of {sorted(VALID_RISK_TOLERANCE)}"
            }
        payload["risk_tolerance"] = rt
    if (args or {}).get("risk_capacity"):
        rc = str(args["risk_capacity"]).lower().strip()
        if rc not in VALID_RISK_CAPACITY:
            return {
                "error": f"risk_capacity must be one of {sorted(VALID_RISK_CAPACITY)}"
            }
        payload["risk_capacity"] = rc
    if not payload:
        return {"error": "Nothing to update — give me a name, risk tolerance, or risk capacity."}

    payload["id"] = user_id
    db.table("user_profiles").upsert(payload, on_conflict="id").execute()
    return {"status": "updated", "fields": list(payload.keys() - {"id"})}


async def tool_navigate_ui(user_id: str, args: dict[str, Any]) -> dict:
    """Tell the browser to switch tabs / open a panel.

    The result is consumed by the frontend's onAction callback — the agent
    never has to "wait" on the navigation, it just announces "Showing the
    rebalance tab" and the UI updates instantly.
    """
    target = ((args or {}).get("tab") or "").lower().strip()
    if target not in NAVIGABLE_TABS:
        return {
            "error": f"Unknown tab. Choose one of: {', '.join(sorted(NAVIGABLE_TABS))}",
        }
    return {"status": "navigated", "tab": target}


async def tool_open_settings(user_id: str, args: dict[str, Any]) -> dict:
    return {"status": "opened", "panel": "settings"}


async def tool_set_theme(user_id: str, args: dict[str, Any]) -> dict:
    """Switch between light, dark, or system theme."""
    theme = ((args or {}).get("theme") or "").lower().strip()
    if theme not in {"light", "dark", "system"}:
        return {"error": "theme must be 'light', 'dark', or 'system'."}
    return {"status": "theme_set", "theme": theme}


async def tool_delete_holding(user_id: str, args: dict[str, Any]) -> dict:
    """Wipe a position entirely — equivalent to selling all shares."""
    ticker = ((args or {}).get("ticker") or "").upper().strip()
    if not ticker:
        return {"error": "Please tell me which ticker to remove."}
    db = get_db()
    existing = (
        db.table("holdings")
        .select("id, shares, current_value")
        .eq("user_id", user_id)
        .eq("ticker", ticker)
        .execute()
    )
    rows = existing.data or []
    if not rows:
        return {"error": f"You don't own {ticker}."}
    for r in rows:
        db.table("holdings").delete().eq("id", r["id"]).eq("user_id", user_id).execute()
    return {
        "status": "deleted",
        "ticker": ticker,
        "freed_value": round(
            sum(float(r.get("current_value") or 0) for r in rows), 2
        ),
    }


async def tool_delete_goal(user_id: str, args: dict[str, Any]) -> dict:
    name = ((args or {}).get("goal_name") or "").lower().strip()
    if not name:
        return {"error": "Please name the goal you want to delete."}
    db = get_db()
    goals = db.table("goals").select("*").eq("user_id", user_id).execute().data or []
    goal = _match_goal(goals, name)
    if not goal:
        return {"error": f"No goal called '{name}' was found."}
    db.table("goals").delete().eq("id", goal["id"]).eq("user_id", user_id).execute()
    return {"status": "deleted", "goal_name": goal.get("goal_name")}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _match_goal(goals: list[dict], needle: str) -> dict | None:
    """Best-effort fuzzy goal lookup. Voice transcripts are noisy, so we
    accept partial matches like 'retirement' → 'My Retirement Plan'."""
    if not needle:
        return goals[0] if goals else None
    needle = needle.lower().strip()
    for g in goals:
        if (g.get("goal_name") or "").lower() == needle:
            return g
    for g in goals:
        if needle in (g.get("goal_name") or "").lower():
            return g
    for g in goals:
        if needle in (g.get("goal_type") or "").lower():
            return g
    return None


# ---------------------------------------------------------------------------
# Registry — what Deepgram sees in the Settings frame
# ---------------------------------------------------------------------------


# (display name in transcript banner, async handler, JSON Schema)
TOOL_REGISTRY: dict[
    str,
    tuple[str, Callable[[str, dict[str, Any]], Awaitable[dict]], dict],
] = {
    "get_portfolio_summary": (
        "Looking at your portfolio",
        tool_get_portfolio_summary,
        {
            "type": "object",
            "properties": {},
            "required": [],
        },
    ),
    "get_holdings": (
        "Pulling up your holdings",
        tool_get_holdings,
        {"type": "object", "properties": {}, "required": []},
    ),
    "list_goals": (
        "Reviewing your goals",
        tool_list_goals,
        {"type": "object", "properties": {}, "required": []},
    ),
    "get_goal_progress": (
        "Checking goal progress",
        tool_get_goal_progress,
        {
            "type": "object",
            "properties": {
                "goal_name": {
                    "type": "string",
                    "description": "Name of the goal, e.g. 'retirement' or 'house'.",
                },
            },
            "required": ["goal_name"],
        },
    ),
    "run_scenario": (
        "Running a market scenario",
        tool_run_scenario,
        {
            "type": "object",
            "properties": {
                "scenario_key": {
                    "type": "string",
                    "enum": list(SCENARIOS.keys()),
                    "description": (
                        "Which historical crisis to simulate against the user's "
                        "current holdings."
                    ),
                }
            },
            "required": ["scenario_key"],
        },
    ),
    "get_recent_alerts": (
        "Reading your alerts",
        tool_get_recent_alerts,
        {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "minimum": 1, "maximum": 20}
            },
            "required": [],
        },
    ),
    "rebalance_portfolio": (
        "Rebalancing your portfolio",
        tool_rebalance_portfolio,
        {
            "type": "object",
            "properties": {
                "goal_name": {
                    "type": "string",
                    "description": (
                        "Optional — which goal to rebalance toward. Defaults to "
                        "the user's first goal."
                    ),
                }
            },
            "required": [],
        },
    ),
    "contribute_to_goal": (
        "Recording a contribution",
        tool_contribute_to_goal,
        {
            "type": "object",
            "properties": {
                "goal_name": {"type": "string"},
                "amount": {"type": "number", "minimum": 0.01},
            },
            "required": ["goal_name", "amount"],
        },
    ),
    "create_goal": (
        "Creating a goal",
        tool_create_goal,
        {
            "type": "object",
            "properties": {
                "goal_name": {"type": "string"},
                "goal_type": {
                    "type": "string",
                    "enum": [
                        "retirement",
                        "house",
                        "college",
                        "emergency",
                        "wedding",
                        "pet",
                        "car",
                        "travel",
                        "other",
                    ],
                },
                "target_date": {
                    "type": "string",
                    "description": "ISO date YYYY-MM-DD when the user needs the money.",
                },
                "target_amount": {"type": "number"},
            },
            "required": ["goal_name", "goal_type", "target_date"],
        },
    ),
    "mark_alerts_read": (
        "Clearing your alerts",
        tool_mark_alerts_read,
        {"type": "object", "properties": {}, "required": []},
    ),
    "buy_holding": (
        "Buying for you",
        tool_buy_holding,
        {
            "type": "object",
            "properties": {
                "ticker": {"type": "string"},
                "shares": {
                    "type": "number",
                    "minimum": 0,
                    "description": "Number of shares to buy. Mutually exclusive with amount_dollars.",
                },
                "amount_dollars": {
                    "type": "number",
                    "minimum": 0,
                    "description": "Dollar amount to buy. We'll convert to shares at the current price.",
                },
                "asset_class": {
                    "type": "string",
                    "enum": [
                        "us_stocks",
                        "intl_stocks",
                        "bonds",
                        "cash",
                        "real_estate",
                        "commodities",
                        "other",
                    ],
                },
                "name": {
                    "type": "string",
                    "description": "Optional friendly name for new positions.",
                },
            },
            "required": ["ticker"],
        },
    ),
    "sell_holding": (
        "Selling for you",
        tool_sell_holding,
        {
            "type": "object",
            "properties": {
                "ticker": {"type": "string"},
                "shares": {"type": "number", "minimum": 0},
                "amount_dollars": {"type": "number", "minimum": 0},
            },
            "required": ["ticker"],
        },
    ),
    "delete_holding": (
        "Removing the position",
        tool_delete_holding,
        {
            "type": "object",
            "properties": {"ticker": {"type": "string"}},
            "required": ["ticker"],
        },
    ),
    "delete_goal": (
        "Deleting the goal",
        tool_delete_goal,
        {
            "type": "object",
            "properties": {"goal_name": {"type": "string"}},
            "required": ["goal_name"],
        },
    ),
    "sync_prices": (
        "Pulling live prices",
        tool_sync_prices,
        {"type": "object", "properties": {}, "required": []},
    ),
    "refresh_news": (
        "Pulling latest news",
        tool_refresh_news,
        {"type": "object", "properties": {}, "required": []},
    ),
    "update_profile": (
        "Updating your profile",
        tool_update_profile,
        {
            "type": "object",
            "properties": {
                "full_name": {"type": "string"},
                "risk_tolerance": {
                    "type": "string",
                    "enum": list(VALID_RISK_TOLERANCE),
                },
                "risk_capacity": {
                    "type": "string",
                    "enum": list(VALID_RISK_CAPACITY),
                },
            },
            "required": [],
        },
    ),
    "navigate_ui": (
        "Switching tabs",
        tool_navigate_ui,
        {
            "type": "object",
            "properties": {
                "tab": {
                    "type": "string",
                    "enum": sorted(NAVIGABLE_TABS),
                    "description": "Which tab to switch to.",
                }
            },
            "required": ["tab"],
        },
    ),
    "open_settings": (
        "Opening settings",
        tool_open_settings,
        {"type": "object", "properties": {}, "required": []},
    ),
    "set_theme": (
        "Changing the theme",
        tool_set_theme,
        {
            "type": "object",
            "properties": {
                "theme": {"type": "string", "enum": ["light", "dark", "system"]}
            },
            "required": ["theme"],
        },
    ),
}


def deepgram_function_specs() -> list[dict]:
    """The function specs we send to Deepgram in the agent Settings frame.

    Deepgram follows the same function-spec shape Anthropic and OpenAI use:
    {name, description, parameters (JSON Schema)}.
    """
    descriptions = {
        "get_portfolio_summary": (
            "Get the user's total portfolio value, current allocation, target "
            "allocation, and drift between them. Call this first when the user "
            "asks about how their portfolio is doing."
        ),
        "get_holdings": (
            "Get the user's individual holdings — ticker, name, asset class, "
            "shares, current value. Use when they ask about a specific stock or "
            "fund."
        ),
        "list_goals": (
            "List all of the user's financial goals (retirement, house, etc) "
            "with target amounts, dates, and current progress."
        ),
        "get_goal_progress": (
            "Get how close the user is to a specific goal by name (e.g. "
            "'retirement', 'house')."
        ),
        "run_scenario": (
            "Simulate how the user's CURRENT portfolio would perform in a past "
            "market crisis. Use when they ask 'what if 2008 happened today' or "
            "similar."
        ),
        "get_recent_alerts": (
            "Get the user's recent portfolio alerts — news that affected their "
            "holdings, drift warnings, etc."
        ),
        "rebalance_portfolio": (
            "ACTUALLY rebalance the user's portfolio toward their target "
            "allocation. This mutates their holdings and creates a new portfolio "
            "snapshot. Use when the user explicitly asks you to rebalance — never "
            "call this without their consent."
        ),
        "contribute_to_goal": (
            "Add money to a financial goal's running total. Use when the user "
            "says they deposited or saved more toward a goal."
        ),
        "create_goal": (
            "Create a new financial goal for the user. Use when they want to "
            "start saving for something new."
        ),
        "mark_alerts_read": (
            "Mark all unread alerts as read. Use when the user says 'clear my "
            "alerts' or similar."
        ),
        "buy_holding": (
            "BUY a security on the user's behalf. Provide either a share count "
            "OR a dollar amount, not both. Always confirm verbally before "
            "calling: 'Want me to buy 5 shares of VTI?' then call only on yes."
        ),
        "sell_holding": (
            "SELL part or all of an existing position. Provide either shares "
            "or dollars. Confirm verbally first."
        ),
        "delete_holding": (
            "Remove a position entirely (sells all shares). Use only with "
            "explicit user consent."
        ),
        "delete_goal": "Delete a financial goal by name. Confirm first.",
        "sync_prices": (
            "Pull fresh live prices from the market for all of the user's "
            "holdings. Use when they say 'sync prices' or 'refresh values'."
        ),
        "refresh_news": (
            "Trigger a fresh news ingestion + classification pass. Use when "
            "they ask 'what's new' or 'pull news'."
        ),
        "update_profile": (
            "Update the user's profile fields (name, risk tolerance, risk "
            "capacity). Use when they say 'change my name to X' or 'set my "
            "risk tolerance to aggressive'."
        ),
        "navigate_ui": (
            "Switch the dashboard to a different tab. Use when the user says "
            "'show me my goals', 'go to rebalance', 'open the activity feed', "
            "etc."
        ),
        "open_settings": (
            "Open the settings dialog. Use when the user says 'open settings' "
            "or 'I want to change something'."
        ),
        "set_theme": (
            "Switch between light, dark, or system theme. Use when the user "
            "says 'turn on dark mode', 'switch to light', etc."
        ),
    }
    out = []
    for name, (_, _handler, schema) in TOOL_REGISTRY.items():
        out.append(
            {
                "name": name,
                "description": descriptions.get(name, name),
                "parameters": schema,
            }
        )
    return out


async def dispatch_tool(name: str, user_id: str, args: dict[str, Any]) -> dict:
    """Single entry point used by the WebSocket proxy."""
    entry = TOOL_REGISTRY.get(name)
    if not entry:
        return {"error": f"Unknown tool '{name}'"}
    _, handler, _ = entry
    try:
        result = handler(user_id, args or {})
        if asyncio.iscoroutine(result):
            return await result
        return result  # type: ignore[return-value]
    except Exception as e:
        return {"error": f"{type(e).__name__}: {e}"}


def display_label(name: str) -> str:
    entry = TOOL_REGISTRY.get(name)
    return entry[0] if entry else name
