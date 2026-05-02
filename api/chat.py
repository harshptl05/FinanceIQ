import json
import uuid
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from core.database import get_db
from core.claude_client import stream_chat, detect_emotional_intent
from financial.rebalancing_math import calculate_current_allocation

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


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None
    # Set ephemeral=True for one-off prompts (e.g. "translate jargon")
    # that shouldn't pollute the saved chat history.
    ephemeral: bool = False


async def _build_user_data(user_id: str) -> dict:
    db = get_db()

    profile_resp = db.table("user_profiles").select("*").eq("id", user_id).execute()
    profile = profile_resp.data[0] if profile_resp.data else {}

    holdings_resp = db.table("holdings").select("*").eq("user_id", user_id).execute()
    holdings = holdings_resp.data or []

    goals_resp = db.table("goals").select("*").eq("user_id", user_id).execute()
    goals = goals_resp.data or []

    alerts_resp = (
        db.table("portfolio_alerts")
        .select("plain_english_explanation, urgency, created_at")
        .eq("user_id", user_id)
        .eq("read", False)
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )
    recent_alerts = alerts_resp.data or []

    total_value = sum(float(h.get("current_value", 0)) for h in holdings)
    current_allocation = calculate_current_allocation(holdings)
    target_allocation = goals[0].get("target_allocation") or {} if goals else {}
    drift = {
        k: round(current_allocation.get(k, 0) - target_allocation.get(k, 0), 4)
        for k in set(list(current_allocation.keys()) + list(target_allocation.keys()))
    }

    return {
        "full_name": profile.get("full_name", "Investor"),
        "risk_tolerance": profile.get("risk_tolerance", "moderate"),
        "risk_capacity": profile.get("risk_capacity", "medium"),
        "goals": goals,
        "holdings": holdings,
        "portfolio_value": total_value,
        "current_allocation": current_allocation,
        "target_allocation": target_allocation,
        "allocation_drift": drift,
        "recent_alerts": recent_alerts,
        "market_context": "Market data powered by real-time feeds.",
    }


def _has_conversation_column(db) -> bool:
    """Quick probe: does chat_history have a conversation_id column?
    The Supabase REST API returns a 4xx with a useful error if the column
    doesn't exist. We cache the answer per-process to avoid the round-trip
    on every request once we know the schema state."""
    global _CONVO_COL_CACHE
    try:
        return _CONVO_COL_CACHE  # type: ignore[name-defined]
    except NameError:
        pass
    try:
        db.table("chat_history").select("conversation_id").limit(1).execute()
        _CONVO_COL_CACHE = True
    except Exception:
        _CONVO_COL_CACHE = False
    return _CONVO_COL_CACHE


@router.post("")
async def chat(body: ChatRequest, authorization: str | None = Header(default=None)):
    user_id = _get_user_id(authorization)
    db = get_db()

    has_convos = _has_conversation_column(db)
    conv_id: str | None = body.conversation_id
    if has_convos and not conv_id and not body.ephemeral:
        conv_id = str(uuid.uuid4())

    # Load context messages — only those in this conversation when supported.
    # Ephemeral requests (translate jargon, one-off explainers) start fresh
    # so they don't cross-contaminate the saved conversation.
    history: list[dict] = []
    if not body.ephemeral:
        history_query = (
            db.table("chat_history").select("role, content").eq("user_id", user_id)
        )
        if has_convos and conv_id:
            history_query = history_query.eq("conversation_id", conv_id)
        history_resp = (
            history_query.order("created_at", desc=False).limit(40).execute()
        )
        history = [
            {"role": r["role"], "content": r["content"]}
            for r in (history_resp.data or [])
        ]

    # Persist the user message — unless this is an ephemeral one-off.
    if not body.ephemeral:
        user_row = {"user_id": user_id, "role": "user", "content": body.message}
        if has_convos and conv_id:
            user_row["conversation_id"] = conv_id
        db.table("chat_history").insert(user_row).execute()

    messages = history + [{"role": "user", "content": body.message}]
    user_data = await _build_user_data(user_id)
    emotional_intent = detect_emotional_intent(body.message)

    full_response: list[str] = []

    async def generate():
        # Tell the client which conversation this turn belongs to so it can
        # remember the id locally and use it for the next message.
        if conv_id:
            yield f"data: {json.dumps({'type': 'conversation', 'id': conv_id})}\n\n"

        async for chunk in stream_chat(messages, user_data, emotional_intent):
            try:
                data = json.loads(chunk.removeprefix("data: ").strip())
                if data.get("type") == "text":
                    full_response.append(data["content"])
            except Exception:
                pass
            yield chunk

        # Persist assistant response after the stream finishes.
        if full_response and not body.ephemeral:
            asst_row = {
                "user_id": user_id,
                "role": "assistant",
                "content": "".join(full_response),
            }
            if has_convos and conv_id:
                asst_row["conversation_id"] = conv_id
            db.table("chat_history").insert(asst_row).execute()

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/history")
def chat_history(authorization: str | None = Header(default=None)):
    """Legacy flat-history endpoint (kept for back-compat)."""
    user_id = _get_user_id(authorization)
    db = get_db()
    resp = (
        db.table("chat_history")
        .select("role, content, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=False)
        .limit(100)
        .execute()
    )
    return {"history": resp.data or []}


@router.get("/conversations")
def list_conversations(authorization: str | None = Header(default=None)):
    """List the user's chat conversations, newest first.

    Each conversation's title is derived from its first user message, and
    rows without a conversation_id are bucketed into a single "Earlier
    chats" pseudo-conversation so they remain accessible after the
    schema migration.
    """
    user_id = _get_user_id(authorization)
    db = get_db()
    if not _has_conversation_column(db):
        return {"conversations": [], "migrated": False}

    resp = (
        db.table("chat_history")
        .select("conversation_id, role, content, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=False)
        .execute()
    )
    rows = resp.data or []

    convs: dict[str, dict] = {}
    legacy_messages = 0
    legacy_first_at: str | None = None
    legacy_last_at: str | None = None

    for r in rows:
        cid = r.get("conversation_id")
        if not cid:
            legacy_messages += 1
            ts = r.get("created_at")
            if ts:
                legacy_first_at = legacy_first_at or ts
                legacy_last_at = ts
            continue

        if cid not in convs:
            convs[cid] = {
                "id": cid,
                "title": None,
                "first_at": r["created_at"],
                "last_at": r["created_at"],
                "message_count": 0,
            }
        convs[cid]["message_count"] += 1
        convs[cid]["last_at"] = r["created_at"]
        if convs[cid]["title"] is None and r["role"] == "user":
            text = (r["content"] or "").strip().splitlines()[0]
            convs[cid]["title"] = text[:80] + ("…" if len(text) > 80 else "")

    out = list(convs.values())
    if legacy_messages > 0:
        out.append(
            {
                "id": "legacy",
                "title": f"Earlier chats ({legacy_messages} message{'s' if legacy_messages != 1 else ''})",
                "first_at": legacy_first_at,
                "last_at": legacy_last_at,
                "message_count": legacy_messages,
                "is_legacy": True,
            }
        )
    out.sort(key=lambda c: (c.get("last_at") or ""), reverse=True)
    return {"conversations": out, "migrated": True}


@router.get("/conversations/{conversation_id}")
def get_conversation(
    conversation_id: str, authorization: str | None = Header(default=None)
):
    user_id = _get_user_id(authorization)
    db = get_db()
    if not _has_conversation_column(db):
        return {"messages": []}

    query = (
        db.table("chat_history")
        .select("role, content, created_at")
        .eq("user_id", user_id)
    )
    if conversation_id == "legacy":
        query = query.is_("conversation_id", "null")
    else:
        query = query.eq("conversation_id", conversation_id)
    resp = query.order("created_at", desc=False).execute()
    return {"messages": resp.data or []}


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: str, authorization: str | None = Header(default=None)
):
    user_id = _get_user_id(authorization)
    db = get_db()
    if not _has_conversation_column(db):
        raise HTTPException(
            status_code=400, detail="Conversation grouping is not enabled yet"
        )

    query = db.table("chat_history").delete().eq("user_id", user_id)
    if conversation_id == "legacy":
        query = query.is_("conversation_id", "null")
    else:
        query = query.eq("conversation_id", conversation_id)
    query.execute()
    return {"deleted": conversation_id}
