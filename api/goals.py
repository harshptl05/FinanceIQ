from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from typing import Any
from core.database import get_db
from financial.glide_path import get_target_allocation
from datetime import datetime, date

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


class GoalCreate(BaseModel):
    goal_type: str
    goal_name: str
    target_date: str
    target_amount: float | None = None
    current_amount: float | None = None
    rebalancing_strategy: str = "hybrid"
    rebalancing_threshold: float = 0.05
    rebalancing_frequency: str = "quarterly"
    account_type: str = "taxable"
    target_allocation: dict | None = None


class GoalUpdate(BaseModel):
    goal_name: str | None = None
    goal_type: str | None = None
    target_date: str | None = None
    target_amount: float | None = None
    current_amount: float | None = None
    target_allocation: dict | None = None
    rebalancing_strategy: str | None = None
    rebalancing_threshold: float | None = None
    rebalancing_frequency: str | None = None
    account_type: str | None = None


class GoalContribution(BaseModel):
    amount: float


@router.post("")
def create_goal(body: GoalCreate, authorization: str | None = Header(default=None)):
    user_id = _get_user_id(authorization)
    db = get_db()

    td = datetime.strptime(body.target_date[:10], "%Y-%m-%d").date()
    years = max((td - date.today()).days / 365.25, 0)
    target_alloc = body.target_allocation or get_target_allocation(body.goal_type, years)

    payload = body.model_dump()
    payload["user_id"] = user_id
    payload["target_allocation"] = target_alloc

    resp = db.table("goals").insert(payload).execute()
    return resp.data[0] if resp.data else {}


@router.get("")
def list_goals(authorization: str | None = Header(default=None)):
    user_id = _get_user_id(authorization)
    db = get_db()
    resp = db.table("goals").select("*").eq("user_id", user_id).execute()
    return {"goals": resp.data or []}


@router.put("/{goal_id}")
def update_goal(goal_id: str, body: GoalUpdate, authorization: str | None = Header(default=None)):
    user_id = _get_user_id(authorization)
    db = get_db()
    updates = body.model_dump(exclude_unset=True)
    if updates.get("target_date") and updates.get("target_allocation") is None:
        try:
            td = datetime.strptime(updates["target_date"][:10], "%Y-%m-%d").date()
            years = max((td - date.today()).days / 365.25, 0)
            cur_resp = db.table("goals").select("goal_type").eq("id", goal_id).eq("user_id", user_id).execute()
            gtype = (cur_resp.data or [{}])[0].get("goal_type") if cur_resp.data else None
            if gtype:
                updates["target_allocation"] = get_target_allocation(updates.get("goal_type") or gtype, years)
        except Exception:
            pass
    resp = db.table("goals").update(updates).eq("id", goal_id).eq("user_id", user_id).execute()
    return resp.data[0] if resp.data else {}


@router.post("/{goal_id}/contribute")
def contribute_to_goal(
    goal_id: str,
    body: GoalContribution,
    authorization: str | None = Header(default=None),
):
    user_id = _get_user_id(authorization)
    db = get_db()
    cur = (
        db.table("goals")
        .select("current_amount")
        .eq("id", goal_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not cur.data:
        raise HTTPException(status_code=404, detail="Goal not found")
    new_amount = float(cur.data[0].get("current_amount") or 0) + float(body.amount)
    resp = (
        db.table("goals")
        .update({"current_amount": round(new_amount, 2)})
        .eq("id", goal_id)
        .eq("user_id", user_id)
        .execute()
    )
    return resp.data[0] if resp.data else {}


@router.delete("/{goal_id}")
def delete_goal(goal_id: str, authorization: str | None = Header(default=None)):
    user_id = _get_user_id(authorization)
    db = get_db()
    db.table("goals").delete().eq("id", goal_id).eq("user_id", user_id).execute()
    return {"deleted": goal_id}
