def assess_risk_capacity(
    years_to_goal: float,
    income_stable: bool,
    has_emergency_fund: bool,
    num_dependents: int,
    has_other_assets: bool,
) -> str:
    score = 0
    if years_to_goal >= 10:
        score += 2
    elif years_to_goal >= 5:
        score += 1

    if income_stable:
        score += 2
    if has_emergency_fund:
        score += 2
    if num_dependents == 0:
        score += 1
    elif num_dependents <= 2:
        score += 0
    else:
        score -= 1
    if has_other_assets:
        score += 1

    if score >= 6:
        return "high"
    elif score >= 3:
        return "medium"
    else:
        return "low"


TOLERANCE_MAP = {"conservative": 1, "moderate": 2, "aggressive": 3}
CAPACITY_MAP = {"low": 1, "medium": 2, "high": 3}


def get_binding_constraint(risk_tolerance: str, risk_capacity: str) -> tuple[str, str | None]:
    """Return (binding_level, warning_message_or_None)."""
    tol = TOLERANCE_MAP.get(risk_tolerance, 2)
    cap = CAPACITY_MAP.get(risk_capacity, 2)

    if tol > cap:
        reverse_tol = {1: "conservative", 2: "moderate", 3: "aggressive"}
        binding = reverse_tol[cap]
        msg = (
            f"You said you're comfortable with {risk_tolerance} risk, but based on your "
            f"financial situation we recommend a {binding} approach. "
            "Your risk capacity is the binding constraint here."
        )
        return binding, msg

    return risk_tolerance, None
