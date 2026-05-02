from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import (
    auth,
    portfolio,
    goals,
    holdings,
    alerts,
    chat,
    scenarios,
    rebalancing,
    news,
)
import agents.news_ingestion as news_agent
import agents.alert_agent as alert_agent
import agents.portfolio_sync as portfolio_agent
import agents.classifier as classification_agent
import agents.rebalancing as rebalancing_agent
import agents.calibrator as calibrator_agent

app = FastAPI(title="FinanceIQ API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["portfolio"])
app.include_router(goals.router, prefix="/api/goals", tags=["goals"])
app.include_router(holdings.router, prefix="/api/holdings", tags=["holdings"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(scenarios.router, prefix="/api/scenarios", tags=["scenarios"])
app.include_router(rebalancing.router, prefix="/api/rebalancing", tags=["rebalancing"])
app.include_router(news.router, prefix="/api/news", tags=["news"])


@app.get("/health")
def health():
    return {
        "status": "alive",
        "agents": {
            "news_ingestion": news_agent.status(),
            "portfolio_sync": portfolio_agent.status(),
            "classification": classification_agent.status(),
            "rebalancing": rebalancing_agent.status(),
            "alert": alert_agent.status(),
            "calibration": calibrator_agent.status(),
        },
        "last_news_event": news_agent.last_event_time(),
        "alerts_sent_today": alert_agent.count_today(),
    }
