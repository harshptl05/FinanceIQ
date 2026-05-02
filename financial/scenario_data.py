SCENARIOS = {
    "2008_financial_crisis": {
        "name": "2008 Financial Crisis",
        "description": "The worst financial crisis since the Great Depression",
        "duration_months": 17,
        "asset_returns": {
            "us_stocks": -0.51,
            "intl_stocks": -0.54,
            "bonds": 0.05,
            "cash": 0.02,
            "real_estate": -0.40,
            "commodities": -0.35,
            "other": -0.30,
        },
    },
    "covid_crash_2020": {
        "name": "COVID Crash (Feb–Mar 2020)",
        "description": "The fastest bear market in history",
        "duration_months": 2,
        "asset_returns": {
            "us_stocks": -0.34,
            "intl_stocks": -0.32,
            "bonds": 0.08,
            "cash": 0.00,
            "real_estate": -0.20,
            "commodities": -0.25,
            "other": -0.20,
        },
    },
    "2022_rate_hikes": {
        "name": "2022 Fed Rate Hikes",
        "description": "Aggressive interest rate increases caused both stocks and bonds to fall",
        "duration_months": 12,
        "asset_returns": {
            "us_stocks": -0.19,
            "intl_stocks": -0.16,
            "bonds": -0.13,
            "cash": 0.03,
            "real_estate": -0.26,
            "commodities": 0.16,
            "other": -0.15,
        },
    },
    "dot_com_crash": {
        "name": "Dot-Com Crash (2000–2002)",
        "description": "The collapse of the tech bubble",
        "duration_months": 30,
        "asset_returns": {
            "us_stocks": -0.49,
            "intl_stocks": -0.45,
            "bonds": 0.30,
            "cash": 0.10,
            "real_estate": 0.05,
            "commodities": 0.10,
            "other": -0.30,
        },
    },
    "high_inflation": {
        "name": "High Inflation Environment",
        "description": "Sustained high inflation eroding purchasing power",
        "duration_months": 24,
        "asset_returns": {
            "us_stocks": -0.10,
            "intl_stocks": -0.08,
            "bonds": -0.20,
            "cash": -0.05,
            "real_estate": 0.15,
            "commodities": 0.30,
            "other": -0.05,
        },
    },
}


def run_scenario(portfolio_holdings: list, scenario_key: str) -> dict:
    scenario = SCENARIOS.get(scenario_key)
    if not scenario:
        return {"error": f"Unknown scenario: {scenario_key}"}

    results = []
    total_before = 0
    total_impact = 0

    for holding in portfolio_holdings:
        current_value = float(holding.get("current_value", 0))
        asset_class = holding.get("asset_class", "other")
        asset_return = scenario["asset_returns"].get(asset_class, 0)
        dollar_impact = current_value * asset_return
        total_before += current_value
        total_impact += dollar_impact

        results.append(
            {
                "name": holding.get("name", holding.get("ticker", "Unknown")),
                "ticker": holding.get("ticker", ""),
                "current_value": current_value,
                "scenario_value": current_value + dollar_impact,
                "dollar_change": dollar_impact,
                "pct_change": asset_return * 100,
            }
        )

    total_after = total_before + total_impact
    pct_change = (total_impact / total_before * 100) if total_before > 0 else 0
    direction = "lost" if total_impact < 0 else "gained"

    return {
        "scenario": scenario["name"],
        "description": scenario["description"],
        "duration_months": scenario["duration_months"],
        "total_portfolio_before": total_before,
        "total_portfolio_after": total_after,
        "total_dollar_impact": total_impact,
        "total_pct_impact": pct_change,
        "holdings_breakdown": results,
        "plain_english": (
            f"In a {scenario['name']}, your portfolio would have "
            f"{direction} approximately ${abs(total_impact):,.0f} "
            f"({abs(pct_change):.1f}%). Here's how each holding would have been affected."
        ),
    }
