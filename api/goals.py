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
    rebalancing_strategy: str = "hybrid"
    rebalancing_threshold: float = 0.05
    rebalancing_frequency: str = "quarterly"
    account_type: str = "taxable"
    target_allocation: dict | None = None


class GoalUpdate(BaseModel):
    goal_name: str | None = None
    target_date: str | None = None
    target_amount: float | None = None
    target_allocation: dict | None = None
    rebalancing_strategy: str | None = None
    rebalancing_threshold: float | None = None
    rebalancing_frequency: str | None = None


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
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    resp = db.table("goals").update(updates).eq("id", goal_id).eq("user_id", user_id).execute()
    return resp.data[0] if resp.data else {}


@router.delete("/{goal_id}")
def delete_goal(goal_id: str, authorization: str | None = Header(default=None)):
    user_id = _get_user_id(authorization)
    db = get_db()
    db.table("goals").delete().eq("id", goal_id).eq("user_id", user_id).execute()
    return {"deleted": goal_id}
