"""
Deepgram Voice Agent WebSocket proxy.

Why a server-side proxy:
  - We never want to ship the Deepgram API key to the browser.
  - Deepgram's function-calling expects the *server* to execute tools and
    send back the result, which means the agent has to terminate on our
    backend so we can hit FinanceIQ APIs with the user's verified Supabase
    identity.

Connection flow:

    [browser]
      ↓  WSS /api/voice/ws?token=<supabase_jwt>
    [FastAPI on Railway]
      ↓  WSS wss://agent.deepgram.com/v1/agent/converse
    [Deepgram Voice Agent]

    binary frames (browser → us → DG):  16kHz mono linear16 PCM (mic)
    binary frames (DG → us → browser):  24kHz mono linear16 PCM (speech)
    JSON frames  (DG → us → browser):   Welcome / SettingsApplied /
                                        ConversationText / AgentThinking /
                                        AgentAudioDone / FunctionCallRequest...

We forward every JSON event to the browser EXCEPT FunctionCallRequest, which
we handle ourselves (call the tool, send FunctionCallResponse upstream, then
forward a synthetic 'tool_event' frame down to the browser so the UI can
show "Rebalancing your portfolio…" badges).
"""

from __future__ import annotations

import asyncio
import inspect
import json
import logging
from typing import Any

import websockets
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from websockets.exceptions import ConnectionClosed

from core.config import settings
from core.database import get_db
from core.voice_tools import (
    deepgram_function_specs,
    dispatch_tool,
    display_label,
)

router = APIRouter()

DEEPGRAM_AGENT_URL = "wss://agent.deepgram.com/v1/agent/converse"

logger = logging.getLogger(__name__)


def _headers_kwarg() -> str:
    """websockets renamed `extra_headers` → `additional_headers` in v14.

    We pin v13 in requirements but a Railway image with a cached newer build
    could ship 14+, so detect the right kwarg at import time instead of
    crashing the connection. The error the user saw on prod was exactly this:
    `create_connection() got an unexpected keyword argument 'additional_headers'`
    (v13's legacy connect doesn't know about it).
    """
    try:
        params = inspect.signature(websockets.connect).parameters
    except (TypeError, ValueError):
        return "extra_headers"
    if "additional_headers" in params:
        return "additional_headers"
    return "extra_headers"


_HEADERS_KW = _headers_kwarg()


SYSTEM_PROMPT = """You are the FinanceIQ voice advisor — a calm, plain-English
financial coach for everyday investors. You can not only talk about their
portfolio, you can actually DO almost anything in the FinanceIQ app on their
behalf, hands-free.

# Style
- Plain English only. Avoid jargon. If you must use a financial term, define
  it in the same breath in five words or less.
- Keep responses to 1-3 sentences for most questions.
- Always use the user's actual numbers — never invent or guess. Call a tool
  before quoting any value.
- Pair numbers with a relatable comparison when natural ("about a nice
  dinner out").
- No markdown, no bullets, no asterisks — this is spoken audio.

# What you can DO (the magic)
Read tools (no confirmation needed):
  - get_portfolio_summary, get_holdings, list_goals, get_goal_progress
  - run_scenario, get_recent_alerts

Action tools (ALWAYS confirm verbally first, then call):
  - rebalance_portfolio — moves real holdings toward the target mix
  - buy_holding / sell_holding — actually buys/sells a position. Provide
    EITHER shares OR amount_dollars, never both. Always confirm the ticker
    and size out loud first ("Want me to buy ten shares of VTI?").
  - delete_holding — removes a position entirely
  - contribute_to_goal — adds money to a goal's running total
  - create_goal — creates a new financial goal
  - delete_goal — removes a goal
  - mark_alerts_read — clears all unread alerts
  - update_profile — change name, risk_tolerance, or risk_capacity
  - sync_prices — pulls fresh live prices for all holdings
  - refresh_news — triggers one news ingestion + classification pass

UI tools (instant, safe — no confirmation needed):
  - navigate_ui — switches the dashboard to dashboard / investment /
    rebalance / activity / goals / ai
  - open_settings — opens the settings dialog
  - set_theme — switches between light, dark, or system theme

# Confirmation rules
- For ANY tool that mutates the user's money or data (buy, sell, rebalance,
  delete, contribute, create, update_profile), ASK FIRST in one short
  sentence and only proceed on explicit yes.
- For navigation, theme, and read tools, just do it and announce.
- After acting, summarize in one sentence ("Done — bought five shares of
  VTI for about a thousand dollars.").

# What you cannot do
- You can't recommend specific tickers as advice (regulatory). You CAN
  execute a buy/sell when the user explicitly tells you to.
- You can't predict short-term price moves.
- You can't give tax, legal, or medical advice.

# Routing examples
- "What am I worth?" → get_portfolio_summary
- "Buy five shares of VTI" → confirm → buy_holding
- "Sell everything in BND" → confirm → sell_holding (or delete_holding)
- "Rebalance me" → confirm → rebalance_portfolio
- "Show me the rebalance tab" → navigate_ui {tab:'rebalance'}
- "Open settings" → open_settings
- "Turn on dark mode" → set_theme {theme:'dark'}
- "Set my risk tolerance to aggressive" → confirm → update_profile
- "Sync my prices" → sync_prices
- "What's new in the news?" → refresh_news → get_recent_alerts
"""


def _build_settings_frame() -> dict:
    """The opening Settings frame Deepgram expects on connect.

    Notes:
      - 16kHz linear16 in / 24kHz linear16 out matches the browser side of
        the hook below; changing these will desync audio.
      - We only configure the 'think' provider as Anthropic. Deepgram routes
        function calls through whichever LLM is active.
    """
    return {
        "type": "Settings",
        "audio": {
            "input": {"encoding": "linear16", "sample_rate": 16000},
            "output": {
                "encoding": "linear16",
                "sample_rate": 24000,
                "container": "none",
            },
        },
        "agent": {
            "language": "en",
            "listen": {"provider": {"type": "deepgram", "model": "nova-3"}},
            "think": {
                "provider": {
                    "type": "anthropic",
                    "model": "claude-haiku-4-5",
                    "temperature": 0.4,
                },
                "prompt": SYSTEM_PROMPT,
                "functions": deepgram_function_specs(),
            },
            "speak": {"provider": {"type": "deepgram", "model": "aura-2-thalia-en"}},
            "greeting": (
                "Hi! I'm your FinanceIQ advisor. I can pull up your portfolio, "
                "answer questions, even rebalance for you if you ask. What's on "
                "your mind?"
            ),
        },
    }


def _resolve_user_id(token: str) -> str | None:
    if not token:
        return None
    try:
        return get_db().auth.get_user(token).user.id
    except Exception:
        return None


@router.websocket("/ws")
async def voice_ws(websocket: WebSocket, token: str = Query(default="")):
    """Browser ↔ Deepgram bridge with FinanceIQ tool-call execution."""
    await websocket.accept()

    if not settings.deepgram_api_key:
        await websocket.send_text(
            json.dumps(
                {
                    "type": "Error",
                    "description": (
                        "Voice agent isn't configured on the server "
                        "(DEEPGRAM_API_KEY missing)."
                    ),
                }
            )
        )
        await websocket.close(code=1011)
        return

    user_id = _resolve_user_id(token)
    if not user_id:
        await websocket.send_text(
            json.dumps(
                {
                    "type": "Error",
                    "description": "Couldn't verify your login — please sign in again.",
                }
            )
        )
        await websocket.close(code=1008)
        return

    headers = {"Authorization": f"Token {settings.deepgram_api_key}"}
    connect_kwargs: dict[str, Any] = {
        _HEADERS_KW: headers,
        "max_size": None,
        "ping_interval": 20,
        "ping_timeout": 20,
        "open_timeout": 15,
    }
    try:
        async with websockets.connect(DEEPGRAM_AGENT_URL, **connect_kwargs) as dg_ws:
            await dg_ws.send(json.dumps(_build_settings_frame()))

            keepalive_task = asyncio.create_task(_keepalive(dg_ws))
            browser_task = asyncio.create_task(_browser_to_dg(websocket, dg_ws))
            dg_task = asyncio.create_task(_dg_to_browser(dg_ws, websocket, user_id))

            done, pending = await asyncio.wait(
                {browser_task, dg_task, keepalive_task},
                return_when=asyncio.FIRST_COMPLETED,
            )
            for t in pending:
                t.cancel()
                try:
                    await t
                except (asyncio.CancelledError, Exception):
                    pass
    except WebSocketDisconnect:
        return
    except Exception as e:
        logger.exception("voice_ws fatal: %s", e)
        try:
            await websocket.send_text(
                json.dumps({"type": "Error", "description": f"Voice connection lost: {e}"})
            )
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Pipes
# ---------------------------------------------------------------------------


async def _keepalive(dg_ws) -> None:
    """Deepgram drops idle agent sockets after ~30s. Send KeepAlive every 5s."""
    try:
        while True:
            await asyncio.sleep(5)
            await dg_ws.send(json.dumps({"type": "KeepAlive"}))
    except (ConnectionClosed, asyncio.CancelledError):
        return
    except Exception as e:
        logger.debug("keepalive ended: %s", e)


async def _browser_to_dg(browser: WebSocket, dg_ws) -> None:
    """Forward mic audio (binary) and any control text from the browser."""
    try:
        while True:
            msg = await browser.receive()
            if msg.get("type") == "websocket.disconnect":
                return
            if "bytes" in msg and msg["bytes"] is not None:
                await dg_ws.send(msg["bytes"])
            elif "text" in msg and msg["text"] is not None:
                # Allow the browser to send control frames too (e.g. the
                # built-in 'InjectAgentMessage' or 'Settings' updates).
                await dg_ws.send(msg["text"])
    except WebSocketDisconnect:
        return
    except (ConnectionClosed, asyncio.CancelledError):
        return
    except Exception as e:
        logger.debug("browser_to_dg ended: %s", e)


async def _dg_to_browser(dg_ws, browser: WebSocket, user_id: str) -> None:
    """Forward Deepgram → browser, intercepting function-call requests."""
    try:
        async for raw in dg_ws:
            if isinstance(raw, (bytes, bytearray)):
                # TTS audio chunk — pass through as-is for AudioBuffer playback.
                await browser.send_bytes(bytes(raw))
                continue

            # JSON control frame from Deepgram.
            try:
                event = json.loads(raw)
            except Exception:
                # Forward unknown text frames so the browser can debug them.
                await browser.send_text(raw)
                continue

            evt_type = event.get("type")

            if evt_type == "FunctionCallRequest":
                await _handle_function_call(event, dg_ws, browser, user_id)
                continue

            await browser.send_text(json.dumps(event))
    except (ConnectionClosed, asyncio.CancelledError, WebSocketDisconnect):
        return
    except Exception as e:
        logger.debug("dg_to_browser ended: %s", e)


async def _handle_function_call(
    event: dict[str, Any],
    dg_ws,
    browser: WebSocket,
    user_id: str,
) -> None:
    """Run the requested tool, send result back to Deepgram, and surface a
    transcript-style badge to the browser so the user can see what's happening.
    """
    # Deepgram's payload shape changed in late 2025 — the new schema has a
    # 'functions' array, the older one had 'function_call'. Handle both.
    calls: list[dict[str, Any]] = []
    if isinstance(event.get("functions"), list):
        calls = event["functions"]
    elif "function_name" in event:
        calls = [
            {
                "id": event.get("function_call_id") or event.get("id"),
                "name": event.get("function_name"),
                "arguments": event.get("input") or event.get("arguments") or {},
            }
        ]
    elif isinstance(event.get("function_call"), dict):
        fc = event["function_call"]
        calls = [
            {
                "id": fc.get("id"),
                "name": fc.get("name"),
                "arguments": fc.get("arguments") or {},
            }
        ]

    responses = []
    for call in calls:
        name = call.get("name") or ""
        call_id = call.get("id") or call.get("function_call_id")
        raw_args = call.get("arguments") or call.get("input") or {}
        args: dict[str, Any]
        if isinstance(raw_args, str):
            try:
                args = json.loads(raw_args) if raw_args else {}
            except Exception:
                args = {}
        else:
            args = raw_args  # type: ignore[assignment]

        # Tell the browser something is happening so the UI can show a badge.
        try:
            await browser.send_text(
                json.dumps(
                    {
                        "type": "ToolCallStarted",
                        "name": name,
                        "label": display_label(name),
                    }
                )
            )
        except Exception:
            pass

        result = await dispatch_tool(name, user_id, args)
        result_json = json.dumps(result)

        try:
            await browser.send_text(
                json.dumps(
                    {
                        "type": "ToolCallFinished",
                        "name": name,
                        "label": display_label(name),
                        "result": result,
                    }
                )
            )
        except Exception:
            pass

        responses.append({"id": call_id, "name": name, "content": result_json})

    # Send a single FunctionCallResponse covering every requested call.
    if responses:
        await dg_ws.send(
            json.dumps({"type": "FunctionCallResponse", "functions": responses})
        )
