import asyncio
from core.logger import get_logger
import agents.news_ingestion as news_agent
import agents.portfolio_sync as portfolio_agent
import agents.classifier as classification_agent
import agents.rebalancing as rebalancing_agent
import agents.alert_agent as alert_agent
import agents.calibrator as calibrator_agent

logger = get_logger("orchestrator")


async def on_news_event(event: dict) -> None:
    await classification_agent.classify_event(event)


async def on_classified(news_event: dict, user_id: str, classification: dict) -> None:
    await asyncio.gather(
        alert_agent.send_alert(news_event, user_id, classification),
        rebalancing_agent.process_event(news_event, user_id, classification),
    )


async def run_agent_safe(agent_module, name: str) -> None:
    while True:
        try:
            await agent_module.run()
        except Exception as e:
            logger.error(f"{name} crashed: {e}. Restarting in 60s...")
            await asyncio.sleep(60)


async def main() -> None:
    logger.info("OrchestratorAgent starting all agents...")

    news_agent.set_callback(on_news_event)
    classification_agent.set_callback(on_classified)

    await asyncio.gather(
        run_agent_safe(news_agent, "NewsIngestionAgent"),
        run_agent_safe(portfolio_agent, "PortfolioSyncAgent"),
        run_agent_safe(calibrator_agent, "CalibrationAgent"),
        classification_agent.run(),
        rebalancing_agent.run(),
        alert_agent.run(),
    )


if __name__ == "__main__":
    asyncio.run(main())
