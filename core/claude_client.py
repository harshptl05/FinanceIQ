import json
from typing import AsyncGenerator
import anthropic
from core.config import settings
from core.logger import get_logger

logger = get_logger("claude_client")

_client: anthropic.AsyncAnthropic | None = None

# Per CLAUDE.md the project targets Claude Sonnet 4. The previous string
# "claude-opus-4-7" is not a real Anthropic model id and broke every chat
# request silently.
CHAT_MODEL = "claude-sonnet-4-20250514"

TOOLS = [
    {
        "name": "get_stock_info",
        "description": "Get current price, performance, and basic info for a stock or ETF ticker",
        "input_schema": {
            "type": "object",
            "properties": {"ticker": {"type": "string"}},
            "required": ["ticker"],
        },
    },
    {
        "name": "get_fund_breakdown",
        "description": "Get what's inside a mutual fund or ETF — top holdings, sector breakdown, expense ratio",
        "input_schema": {
            "type": "object",
            "properties": {"ticker": {"type": "string"}},
            "required": ["ticker"],
        },
    },
    {
        "name": "run_scenario",
        "description": "Simulate how the user's current portfolio would have performed in a historical scenario",
        "input_schema": {
            "type": "object",
            "properties": {
                "scenario": {
                    "type": "string",
                    "enum": [
                        "2008_financial_crisis",
                        "covid_crash_2020",
                        "2022_rate_hikes",
                        "dot_com_crash",
                        "high_inflation",
                    ],
                }
            },
            "required": ["scenario"],
        },
    },
    {
        "name": "check_goal_progress",
        "description": "Calculate if user is on track for a specific financial goal",
        "input_schema": {
            "type": "object",
            "properties": {"goal_id": {"type": "string"}},
            "required": ["goal_id"],
        },
    },
    {
        "name": "get_rebalancing_recommendation",
        "description": "Generate a fresh rebalancing recommendation for the user's portfolio",
        "input_schema": {
            "type": "object",
            "properties": {"goal_id": {"type": "string"}},
            "required": ["goal_id"],
        },
    },
    {
        "name": "get_macro_data",
        "description": "Get current macroeconomic indicators — interest rates, inflation, market conditions",
        "input_schema": {"type": "object", "properties": {}},
    },
]

EMOTIONAL_PATTERNS = [
    ("sell everything", "panic_selling"),
    ("sell all", "panic_selling"),
    ("get out", "panic_selling"),
    ("pull out my money", "panic_selling"),
    ("everyone is buying", "fomo"),
    ("i need to buy", "fomo"),
    ("going to the moon", "fomo"),
    ("i lost so much", "loss_aversion"),
    ("should i be worried", "anxiety"),
]


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


def detect_emotional_intent(message: str) -> str | None:
    lower = message.lower()
    for pattern, intent_type in EMOTIONAL_PATTERNS:
        if pattern in lower:
            return intent_type
    return None


def build_behavioral_context(intent_type: str) -> str:
    if intent_type == "panic_selling":
        return (
            "The user appears to be considering panic selling. "
            "Gently acknowledge their concern, validate the emotion, "
            "then provide historical data showing that investors who held "
            "through similar drops recovered. Reference their specific "
            "timeline and whether they actually need this money soon."
        )
    if intent_type == "fomo":
        return (
            "The user appears to be considering a FOMO purchase. "
            "Gently explain the risks of chasing returns, reference their "
            "existing allocation, and ask if this would fit their actual goals."
        )
    if intent_type == "loss_aversion":
        return (
            "The user is expressing loss aversion. Acknowledge the pain of seeing losses, "
            "then reframe with long-term perspective and their specific timeline."
        )
    if intent_type == "anxiety":
        return (
            "The user is expressing investment anxiety. Be reassuring but honest. "
            "Walk them through what their portfolio is actually doing vs. their goals."
        )
    return ""


def build_system_prompt(user_data: dict) -> str:
    return f"""You are a friendly, knowledgeable financial advisor for everyday investors.

CRITICAL RULES:
- NEVER use financial jargon without immediately explaining it in plain English
- ALWAYS reference the user's specific numbers and holdings, never give generic advice
- ALWAYS explain WHY before WHAT — help users understand, not just follow instructions
- Speak like a trusted friend who happens to be a financial expert, not a robot or salesman
- When recommending action, always explain the downside risk too
- Never guarantee returns or make specific predictions
- If you detect the user is about to make an emotional decision (panic selling, FOMO), gently intervene

ANTI-HALLUCINATION RULES (HARD):
- You do NOT have direct access to today's news. If the user asks about "today",
  recent Fed decisions, or breaking events, call the get_macro_data or
  get_stock_info tools FIRST. If those tools fail or return nothing, say
  "I don't have a verified data point on that yet" — do not invent dates,
  rate decisions, earnings prints, or headlines.
- Only state that the Fed raised/cut rates if get_macro_data returned a recent
  change in FEDFUNDS. Otherwise describe the current rate level only.
- Never make up news headlines, ticker prices, or dollar impacts. Use the tools.

USER PROFILE:
Name: {user_data.get('full_name', 'Investor')}
Risk Tolerance: {user_data.get('risk_tolerance', 'moderate')}
Risk Capacity: {user_data.get('risk_capacity', 'medium')}

GOALS:
{json.dumps(user_data.get('goals', []), indent=2)}

CURRENT PORTFOLIO:
Total Value: ${user_data.get('portfolio_value', 0):,.2f}
Current Allocation: {json.dumps(user_data.get('current_allocation', {}), indent=2)}
Target Allocation: {json.dumps(user_data.get('target_allocation', {}), indent=2)}
Drift from Target: {json.dumps(user_data.get('allocation_drift', {}), indent=2)}

HOLDINGS:
{json.dumps(user_data.get('holdings', []), indent=2)}

RECENT ALERTS:
{json.dumps(user_data.get('recent_alerts', []), indent=2)}

TODAY'S MARKET CONTEXT:
{user_data.get('market_context', 'Market data unavailable.')}"""


async def execute_tool(tool_name: str, tool_input: dict, user_data: dict) -> str:
    """Execute a Claude tool call and return the result as a string."""
    try:
        if tool_name == "get_stock_info":
            from data.market_data import get_stock_info
            return json.dumps(await get_stock_info(tool_input["ticker"]))
        elif tool_name == "get_fund_breakdown":
            from data.fund_data import get_fund_breakdown
            return json.dumps(await get_fund_breakdown(tool_input["ticker"]))
        elif tool_name == "run_scenario":
            from financial.scenario_data import run_scenario
            holdings = user_data.get("holdings", [])
            return json.dumps(run_scenario(holdings, tool_input["scenario"]))
        elif tool_name == "check_goal_progress":
            from financial.portfolio_math import check_goal_progress
            goal_id = tool_input["goal_id"]
            goals = user_data.get("goals", [])
            goal = next((g for g in goals if g["id"] == goal_id), None)
            if not goal:
                return json.dumps({"error": "Goal not found"})
            return json.dumps(check_goal_progress(goal, user_data.get("portfolio_value", 0)))
        elif tool_name == "get_rebalancing_recommendation":
            from financial.rebalancing_math import generate_recommendation
            return json.dumps(generate_recommendation(user_data, tool_input.get("goal_id")))
        elif tool_name == "get_macro_data":
            from data.fred_client import get_macro_summary
            return json.dumps(await get_macro_summary())
        else:
            return json.dumps({"error": f"Unknown tool: {tool_name}"})
    except Exception as e:
        logger.error(f"Tool {tool_name} failed: {e}")
        return json.dumps({"error": str(e)})


async def stream_chat(
    messages: list[dict], user_data: dict, emotional_intent: str | None = None
) -> AsyncGenerator[str, None]:
    """Stream a chat response from Claude, handling tool calls."""
    client = get_client()
    system = build_system_prompt(user_data)
    if emotional_intent:
        system += f"\n\nBEHAVIORAL NOTE: {build_behavioral_context(emotional_intent)}"

    current_messages = list(messages)

    while True:
        async with client.messages.stream(
            model=CHAT_MODEL,
            max_tokens=2048,
            system=system,
            messages=current_messages,
            tools=TOOLS,
        ) as stream:
            tool_calls = []
            full_text = ""

            async for event in stream:
                if hasattr(event, "type"):
                    if event.type == "content_block_start":
                        if hasattr(event, "content_block"):
                            if event.content_block.type == "tool_use":
                                tool_calls.append({
                                    "id": event.content_block.id,
                                    "name": event.content_block.name,
                                    "input": "",
                                })
                                yield f"data: {json.dumps({'type': 'tool_start', 'tool': event.content_block.name})}\n\n"
                    elif event.type == "content_block_delta":
                        if hasattr(event, "delta"):
                            if event.delta.type == "text_delta":
                                full_text += event.delta.text
                                yield f"data: {json.dumps({'type': 'text', 'content': event.delta.text})}\n\n"
                            elif event.delta.type == "input_json_delta":
                                if tool_calls:
                                    tool_calls[-1]["input"] += event.delta.partial_json

            final_message = await stream.get_final_message()

            if final_message.stop_reason != "tool_use":
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                return

            # Process tool calls
            assistant_content = final_message.content
            tool_results = []
            for block in assistant_content:
                if block.type == "tool_use":
                    input_data = block.input if isinstance(block.input, dict) else {}
                    result = await execute_tool(block.name, input_data, user_data)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result,
                    })
                    yield f"data: {json.dumps({'type': 'tool_end', 'tool': block.name})}\n\n"

            current_messages = current_messages + [
                {"role": "assistant", "content": assistant_content},
                {"role": "user", "content": tool_results},
            ]
