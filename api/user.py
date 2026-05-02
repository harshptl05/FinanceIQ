"""User profile endpoints — used by the Settings dialog."""

from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from core.database import get_db

router = APIRouter()


VALID_RISK_TOLERANCE = {"conservative", "moderate", "aggressive"}
VALID_RISK_CAPACITY = {"low", "medium", "high"}


def _get_user_id(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    db = get_db()
    try:
        return db.auth.get_user(token).user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    risk_tolerance: str | None = None
    risk_capacity: str | None = None


@router.get("/profile")
def get_profile(authorization: str | None = Header(default=None)):
    user_id = _get_user_id(authorization)
    db = get_db()

    auth_user = None
    try:
        token = (authorization or "").split(" ", 1)[1]
        auth_user = db.auth.get_user(token).user
    except Exception:
        auth_user = None

    resp = (
        db.table("user_profiles").select("*").eq("id", user_id).limit(1).execute()
    )
    profile = (resp.data or [{}])[0] if resp.data else {}

    # Auto-create the row on first read so the rest of the app can rely on it.
    if not resp.data:
        try:
            full_name = (
                (auth_user.user_metadata or {}).get("full_name")
                if auth_user
                else None
            ) or (auth_user.email.split("@")[0] if auth_user and auth_user.email else "")
            db.table("user_profiles").insert(
                {
                    "id": user_id,
                    "full_name": full_name or "Investor",
                    "risk_tolerance": "moderate",
                    "risk_capacity": "medium",
                }
            ).execute()
            profile = {
                "id": user_id,
                "full_name": full_name,
                "risk_tolerance": "moderate",
                "risk_capacity": "medium",
            }
        except Exception:
            # Permissions or duplicate row — degrade gracefully.
            pass

    return {
        "id": user_id,
        "email": auth_user.email if auth_user else None,
        "full_name": profile.get("full_name"),
        "risk_tolerance": profile.get("risk_tolerance"),
        "risk_capacity": profile.get("risk_capacity"),
        "created_at": profile.get("created_at"),
    }


@router.put("/profile")
def update_profile(
    body: ProfileUpdate, authorization: str | None = Header(default=None)
):
    user_id = _get_user_id(authorization)
    payload = body.model_dump(exclude_unset=True, exclude_none=True)

    if "risk_tolerance" in payload and payload["risk_tolerance"] not in VALID_RISK_TOLERANCE:
        raise HTTPException(
            status_code=400,
            detail=f"risk_tolerance must be one of {sorted(VALID_RISK_TOLERANCE)}",
        )
    if "risk_capacity" in payload and payload["risk_capacity"] not in VALID_RISK_CAPACITY:
        raise HTTPException(
            status_code=400,
            detail=f"risk_capacity must be one of {sorted(VALID_RISK_CAPACITY)}",
        )

    if not payload:
        raise HTTPException(status_code=400, detail="Nothing to update")

    db = get_db()
    # Upsert: insert if missing, update if present. Supabase-py's upsert
    # needs the row's primary key, so we set it explicitly.
    payload["id"] = user_id
    try:
        resp = (
            db.table("user_profiles")
            .upsert(payload, on_conflict="id")
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Profile update failed: {e}")

    return resp.data[0] if resp.data else payload
