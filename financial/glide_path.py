GLIDE_PATH = {
    "retirement": {
        20: {"us_stocks": 0.70, "intl_stocks": 0.20, "bonds": 0.10, "cash": 0.00},
        15: {"us_stocks": 0.60, "intl_stocks": 0.15, "bonds": 0.20, "cash": 0.05},
        10: {"us_stocks": 0.50, "intl_stocks": 0.10, "bonds": 0.30, "cash": 0.10},
        5:  {"us_stocks": 0.35, "intl_stocks": 0.05, "bonds": 0.45, "cash": 0.15},
        2:  {"us_stocks": 0.20, "intl_stocks": 0.00, "bonds": 0.50, "cash": 0.30},
    },
    "house": {
        5: {"us_stocks": 0.40, "intl_stocks": 0.00, "bonds": 0.40, "cash": 0.20},
        3: {"us_stocks": 0.20, "intl_stocks": 0.00, "bonds": 0.30, "cash": 0.50},
        1: {"us_stocks": 0.00, "intl_stocks": 0.00, "bonds": 0.20, "cash": 0.80},
    },
    "college": {
        10: {"us_stocks": 0.70, "intl_stocks": 0.05, "bonds": 0.20, "cash": 0.05},
        5:  {"us_stocks": 0.40, "intl_stocks": 0.00, "bonds": 0.40, "cash": 0.20},
        2:  {"us_stocks": 0.10, "intl_stocks": 0.00, "bonds": 0.40, "cash": 0.50},
    },
    "emergency": {
        0: {"us_stocks": 0.00, "intl_stocks": 0.00, "bonds": 0.00, "cash": 1.00},
    },
    "other": {
        20: {"us_stocks": 0.60, "intl_stocks": 0.15, "bonds": 0.20, "cash": 0.05},
        10: {"us_stocks": 0.50, "intl_stocks": 0.10, "bonds": 0.30, "cash": 0.10},
        5:  {"us_stocks": 0.40, "intl_stocks": 0.05, "bonds": 0.40, "cash": 0.15},
        2:  {"us_stocks": 0.20, "intl_stocks": 0.00, "bonds": 0.50, "cash": 0.30},
    },
}


def get_target_allocation(goal_type: str, years_to_goal: float) -> dict:
    path = GLIDE_PATH.get(goal_type, GLIDE_PATH["other"])
    available_years = sorted(path.keys())
    for years in available_years:
        if years_to_goal <= years:
            return path[years]
    return path[max(available_years)]
