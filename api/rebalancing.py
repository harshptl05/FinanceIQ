from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from core.database import get_db
from financial.rebalancing_math import generate_recommendation

router = APIRouter()


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

        # Only insert if there isn't already a pending recommendation for
        # this goal — otherwise "Re-check now" would pile up duplicates.
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

        # Friendly labels for the asset class keys so the explanation reads
        # naturally instead of leaking raw db keys like "us_stocks".
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
    resp = (
        db.table("rebalancing_recommendations")
        .update({"status": body.status})
        .eq("id", rec_id)
        .eq("user_id", user_id)
        .execute()
    )
    return resp.data[0] if resp.data else {}


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
