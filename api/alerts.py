from fastapi import APIRouter, Header, HTTPException
from core.database import get_db

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


@router.get("")
def list_alerts(authorization: str | None = Header(default=None)):
    user_id = _get_user_id(authorization)
    db = get_db()
    resp = (
        db.table("portfolio_alerts")
        .select("*")
        .eq("user_id", user_id)
        .eq("read", False)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return {"alerts": resp.data or []}


@router.put("/{alert_id}/read")
def mark_read(alert_id: str, authorization: str | None = Header(default=None)):
    user_id = _get_user_id(authorization)
    db = get_db()
    db.table("portfolio_alerts").update({"read": True}).eq("id", alert_id).eq("user_id", user_id).execute()
    return {"updated": alert_id}
