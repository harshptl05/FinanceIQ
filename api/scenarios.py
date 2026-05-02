from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from core.database import get_db
from financial.scenario_data import run_scenario, SCENARIOS

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


class ScenarioRequest(BaseModel):
    scenario_key: str
    goal_id: str | None = None


@router.get("")
def list_scenarios():
    return {
        "scenarios": [
            {"key": k, "name": v["name"], "description": v["description"], "duration_months": v["duration_months"]}
            for k, v in SCENARIOS.items()
        ]
    }


@router.post("/run")
def run_scenario_endpoint(body: ScenarioRequest, authorization: str | None = Header(default=None)):
    user_id = _get_user_id(authorization)
    db = get_db()

    query = db.table("holdings").select("*").eq("user_id", user_id)
    if body.goal_id:
        query = query.eq("goal_id", body.goal_id)
    holdings_resp = query.execute()
    holdings = holdings_resp.data or []

    if not holdings:
        raise HTTPException(status_code=404, detail="No holdings found")

    result = run_scenario(holdings, body.scenario_key)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result
