from collections import defaultdict
from datetime import date, datetime, time, timedelta
from statistics import mean, median

from sqlalchemy.orm import Session

from models.models import Meal, User
from schemas import (
    PredictiveAnalyticsResponse,
    PredictiveAnomaly,
    PredictiveForecastPoint,
    PredictiveInsight,
)


def as_float(value) -> float:
    return float(value or 0)


def date_range(start: date, end: date) -> list[date]:
    days: list[date] = []
    cursor = start
    while cursor <= end:
        days.append(cursor)
        cursor += timedelta(days=1)
    return days


def clamp(value: float, lower: float = 0, upper: float | None = None) -> float:
    value = max(lower, value)
    if upper is not None:
        value = min(value, upper)
    return value


# Forecasting. Each model is fitted on one user's logged days (date, value) and predicts a logged day's value
# for target dates. Unlogged days are gaps, not zeros. select_model() picks, per metric, the model with the
# lowest one-step-ahead error when replayed over the user's own recent history.
Points = list[tuple[date, float]]


def forecast_mean(history: Points, targets: list[date]) -> list[float]:
    level = mean(v for _, v in history)
    return [level] * len(targets)


def forecast_weekday(history: Points, targets: list[date], shrink: float = 2.0) -> list[float]:
    """Mean per day of the week, pulled toward the overall mean when that weekday has few logs."""
    overall = mean(v for _, v in history)
    by_day: dict[int, list[float]] = defaultdict(list)
    for d, v in history:
        by_day[d.weekday()].append(v)

    def estimate(wd: int) -> float:
        vals = by_day.get(wd, [])
        return (sum(vals) + shrink * overall) / (len(vals) + shrink)

    return [estimate(t.weekday()) for t in targets]


def forecast_damped_trend(
    history: Points, targets: list[date], alpha: float = 0.3, beta: float = 0.1, phi: float = 0.9
) -> list[float]:
    """Holt's linear smoothing with a damped trend, so a recent rise levels off instead of running away."""
    values = [v for _, v in history]
    # Start from a straight line fitted to the first week: two noisy days make a bad starting trend.
    first = values[:7]
    x_avg, y_avg = (len(first) - 1) / 2, mean(first)
    spread = sum((x - x_avg) ** 2 for x in range(len(first)))
    trend = sum((x - x_avg) * (y - y_avg) for x, y in enumerate(first)) / spread if spread else 0.0
    level = y_avg + trend * (len(first) - 1 - x_avg)
    for v in values[len(first):]:
        previous = level
        level = alpha * v + (1 - alpha) * (level + phi * trend)
        trend = beta * (level - previous) + (1 - beta) * phi * trend
    out, damping = [], 0.0
    for h in range(1, len(targets) + 1):
        damping += phi**h
        out.append(level + damping * trend)
    return out


MODELS = {"mean": forecast_mean, "weekday": forecast_weekday, "damped_trend": forecast_damped_trend}
MIN_POINTS_TO_SELECT = 6  # below this there are too few replays to tell models apart


def backtest_mae(model, history: Points, replays: int = 10) -> float:
    """Mean absolute error of one-step-ahead predictions over the last `replays` logged days."""
    start = max(3, len(history) - replays)
    errors = [abs(model(history[:i], [history[i][0]])[0] - history[i][1]) for i in range(start, len(history))]
    return mean(errors)


SWITCH_MARGIN = 0.9  # leave the plain mean only for a model with at least 10% lower backtest error


def select_model(history: Points) -> str:
    if len(history) < MIN_POINTS_TO_SELECT:
        return "mean"
    scores = {name: backtest_mae(model, history, replays=len(history)) for name, model in MODELS.items()}
    best = min(scores, key=scores.get)
    return best if scores[best] < scores["mean"] * SWITCH_MARGIN else "mean"


def forecast_metric(history: Points, targets: list[date], upper: float | None) -> tuple[list[float], str]:
    if not history:
        return [0.0] * len(targets), "mean"
    # One-off spikes (a party, a holiday meal) are reported as anomalies, not learned as the new normal.
    history = [p for p, z in zip(history, robust_z([v for _, v in history])) if abs(z) <= ROBUST_Z_LIMIT]
    name = select_model(history)
    return [round(clamp(v, upper=upper), 2) for v in MODELS[name](history, targets)], name


def build_anomalies(
    logged_points: list[tuple[date, float, float, float]],
    calorie_goal: float,
    protein_goal: float,
    daily_budget: float,
) -> list[PredictiveAnomaly]:
    anomalies: list[PredictiveAnomaly] = []
    if not logged_points:
        return anomalies

    calories = [point[1] for point in logged_points]
    costs = [point[3] for point in logged_points]
    calorie_z, cost_z = robust_z(calories), robust_z(costs)
    calorie_median, cost_median = median(calories), median(costs)

    calorie_low_threshold = calorie_goal * 0.50 if calorie_goal else 0
    cost_budget_threshold = daily_budget * 1.25 if daily_budget else 0
    protein_low_threshold = protein_goal * 0.65 if protein_goal else 0

    for i, (point_date, calorie_value, protein_value, cost_value) in enumerate(logged_points):
        if calorie_z[i] > ROBUST_Z_LIMIT:
            anomalies.append(
                PredictiveAnomaly(
                    date=point_date,
                    metric="calories",
                    value=round(calorie_value, 2),
                    expected_value=round(calorie_median, 2),
                    severity="warning",
                    message="Calorie intake is materially above your usual day.",
                )
            )
        elif calorie_low_threshold and calorie_value < calorie_low_threshold:
            anomalies.append(
                PredictiveAnomaly(
                    date=point_date,
                    metric="calories",
                    value=round(calorie_value, 2),
                    expected_value=round(calorie_goal, 2),
                    severity="info",
                    message="Logged calories are far below the current daily target.",
                )
            )

        if protein_low_threshold and protein_value < protein_low_threshold:
            anomalies.append(
                PredictiveAnomaly(
                    date=point_date,
                    metric="protein",
                    value=round(protein_value, 2),
                    expected_value=round(protein_goal, 2),
                    severity="warning",
                    message="Protein intake is well below the current target.",
                )
            )

        over_budget = bool(cost_budget_threshold and cost_value > cost_budget_threshold)
        if over_budget or cost_z[i] > ROBUST_Z_LIMIT:
            anomalies.append(
                PredictiveAnomaly(
                    date=point_date,
                    metric="cost",
                    value=round(cost_value, 2),
                    expected_value=round(daily_budget if over_budget else cost_median, 2),
                    severity="warning",
                    message=(
                        "Food spend is well above the daily budget."
                        if over_budget
                        else "Food spend is materially above your usual day."
                    ),
                )
            )

    return anomalies[:10]


ROBUST_Z_LIMIT = 3.5  # Iglewicz and Hoaglin's cut-off for the modified z-score
MIN_POINTS_FOR_OUTLIERS = 5


def robust_z(values: list[float]) -> list[float]:
    """Modified z-scores from the median and the median absolute deviation, which one spike cannot drag
    the way it drags a mean and standard deviation. Zeros when there are too few days to judge."""
    if len(values) < MIN_POINTS_FOR_OUTLIERS:
        return [0.0] * len(values)
    centre = median(values)
    mad = median(abs(v - centre) for v in values)
    if mad:
        return [0.6745 * (v - centre) / mad for v in values]
    # Over half the days are identical: fall back to the mean absolute deviation (Iglewicz and Hoaglin).
    mean_ad = mean(abs(v - centre) for v in values)
    return [(v - centre) / (1.253314 * mean_ad) if mean_ad else 0.0 for v in values]


def build_insights(
    days_logged: int,
    days_considered: int,
    budget_risk: bool,
    protein_goal_risk: bool,
    calorie_goal_risk: bool,
    predicted_weekly_cost: float,
    weekly_budget: float,
    predicted_avg_calories: float,
    calorie_goal: float,
    predicted_avg_protein: float,
    protein_goal: float,
    anomalies: list[PredictiveAnomaly],
) -> list[PredictiveInsight]:
    insights: list[PredictiveInsight] = []

    if days_logged < 3:
        insights.append(
            PredictiveInsight(
                type="data_volume",
                severity="warning",
                message="Forecast confidence is limited because fewer than 3 logged days are available.",
            )
        )
    elif days_logged / max(days_considered, 1) < 0.35:
        insights.append(
            PredictiveInsight(
                type="data_volume",
                severity="info",
                message="More consistent meal logging will make the next forecast more reliable.",
            )
        )

    if weekly_budget and budget_risk:
        over_by = predicted_weekly_cost - weekly_budget
        insights.append(
            PredictiveInsight(
                type="budget_forecast",
                severity="warning",
                message=f"Projected weekly spend is EUR {over_by:.2f} above the current budget.",
            )
        )
    elif weekly_budget:
        remaining = weekly_budget - predicted_weekly_cost
        insights.append(
            PredictiveInsight(
                type="budget_forecast",
                severity="positive",
                message=f"Projected weekly spend leaves about EUR {remaining:.2f} of budget headroom.",
            )
        )

    if protein_goal and protein_goal_risk:
        insights.append(
            PredictiveInsight(
                type="protein_forecast",
                severity="warning",
                message=(
                    f"Forecast protein averages {predicted_avg_protein:.1f}g/day, "
                    f"below the {protein_goal:.0f}g target."
                ),
            )
        )
    elif protein_goal:
        insights.append(
            PredictiveInsight(
                type="protein_forecast",
                severity="positive",
                message="Forecast protein intake is tracking close to the current goal.",
            )
        )

    if calorie_goal and calorie_goal_risk:
        insights.append(
            PredictiveInsight(
                type="calorie_forecast",
                severity="warning",
                message=(
                    f"Forecast calories average {predicted_avg_calories:.0f} kcal/day, "
                    f"outside the target band around {calorie_goal:.0f} kcal."
                ),
            )
        )
    elif calorie_goal:
        insights.append(
            PredictiveInsight(
                type="calorie_forecast",
                severity="positive",
                message="Forecast calories sit within the target band.",
            )
        )

    if anomalies:
        insights.append(
            PredictiveInsight(
                type="anomaly_detection",
                severity="info",
                message=f"{len(anomalies)} unusual nutrition or spending signals were detected.",
            )
        )

    if not insights:
        insights.append(
            PredictiveInsight(
                type="baseline",
                severity="info",
                message="Keep logging meals to build a stronger forecasting baseline.",
            )
        )

    return insights


def analyse_predictive(
    db: Session,
    user_id: int,
    days: int = 30,
    horizon: int = 7,
) -> PredictiveAnalyticsResponse:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("User not found")

    days = max(7, min(days, 90))
    horizon = max(1, min(horizon, 30))
    period_end = datetime.now().date()
    period_start = period_end - timedelta(days=days - 1)
    start_dt = datetime.combine(period_start, time.min)
    end_dt = datetime.combine(period_end + timedelta(days=1), time.min)

    meals = db.query(Meal).filter(
        Meal.user_id == user_id,
        Meal.logged_at >= start_dt,
        Meal.logged_at < end_dt,
    ).order_by(Meal.logged_at.asc()).all()

    meals_by_day: dict[date, list[Meal]] = defaultdict(list)
    for meal in meals:
        if meal.logged_at:
            meals_by_day[meal.logged_at.date()].append(meal)

    calorie_goal = as_float(user.calorie_goal)
    protein_goal = as_float(user.protein_goal)
    weekly_budget = as_float(user.budget_weekly)
    daily_budget = round(weekly_budget / 7, 2) if weekly_budget else 0

    daily_points: list[PredictiveForecastPoint] = []
    logged_points: list[tuple[date, float, float, float]] = []

    for current_date in date_range(period_start, period_end):
        day_meals = meals_by_day.get(current_date, [])
        calories = round(sum(as_float(meal.total_calories) for meal in day_meals), 2)
        protein = round(sum(as_float(meal.total_protein) for meal in day_meals), 2)
        cost = round(sum(as_float(meal.total_cost_eur) for meal in day_meals), 2)

        daily_points.append(
            PredictiveForecastPoint(
                date=current_date,
                calories=calories,
                protein=protein,
                cost_eur=cost,
            )
        )

        if day_meals:
            logged_points.append((current_date, calories, protein, cost))

    calories_avg = mean([point[1] for point in logged_points]) if logged_points else 0
    protein_avg = mean([point[2] for point in logged_points]) if logged_points else 0
    cost_avg = mean([point[3] for point in logged_points]) if logged_points else 0

    calories_upper = max(calorie_goal * 1.8, calories_avg * 2.4, 500) if calories_avg or calorie_goal else None
    protein_upper = max(protein_goal * 1.8, protein_avg * 2.4, 50) if protein_avg or protein_goal else None
    cost_upper = max(daily_budget * 2.5, cost_avg * 2.5, 10) if cost_avg or daily_budget else None

    targets = [period_end + timedelta(days=offset) for offset in range(1, horizon + 1)]
    calorie_forecast, calorie_model = forecast_metric([(p[0], p[1]) for p in logged_points], targets, calories_upper)
    protein_forecast, protein_model = forecast_metric([(p[0], p[2]) for p in logged_points], targets, protein_upper)
    cost_forecast, cost_model = forecast_metric([(p[0], p[3]) for p in logged_points], targets, cost_upper)
    forecast = [
        PredictiveForecastPoint(date=t, calories=c, protein=p, cost_eur=k)
        for t, c, p, k in zip(targets, calorie_forecast, protein_forecast, cost_forecast)
    ]
    model_type = (
        "average_baseline_v2"
        if len(logged_points) < MIN_POINTS_TO_SELECT
        else f"selected_v2 (calories: {calorie_model}, protein: {protein_model}, cost: {cost_model})"
    )

    forecast_avg_cost = mean([point.cost_eur for point in forecast]) if forecast else 0
    forecast_avg_protein = mean([point.protein for point in forecast]) if forecast else 0
    forecast_avg_calories = mean([point.calories for point in forecast]) if forecast else 0
    predicted_weekly_cost = round(forecast_avg_cost * 7, 2)
    predicted_weekly_protein = round(forecast_avg_protein * 7, 2)
    predicted_avg_calories = round(forecast_avg_calories, 2)

    budget_risk = bool(weekly_budget and predicted_weekly_cost > weekly_budget * 1.05)
    protein_goal_risk = bool(protein_goal and forecast_avg_protein < protein_goal * 0.75)
    calorie_goal_risk = bool(
        calorie_goal
        and (
            forecast_avg_calories < calorie_goal * 0.75
            or forecast_avg_calories > calorie_goal * 1.25
        )
    )

    anomalies = build_anomalies(logged_points, calorie_goal, protein_goal, daily_budget)
    insights = build_insights(
        days_logged=len(logged_points),
        days_considered=days,
        budget_risk=budget_risk,
        protein_goal_risk=protein_goal_risk,
        calorie_goal_risk=calorie_goal_risk,
        predicted_weekly_cost=predicted_weekly_cost,
        weekly_budget=weekly_budget,
        predicted_avg_calories=predicted_avg_calories,
        calorie_goal=calorie_goal,
        predicted_avg_protein=round(forecast_avg_protein, 2),
        protein_goal=protein_goal,
        anomalies=anomalies,
    )

    return PredictiveAnalyticsResponse(
        user_id=user_id,
        period_start=period_start,
        period_end=period_end,
        horizon_days=horizon,
        model_type=model_type,
        daily=daily_points,
        forecast=forecast,
        anomalies=anomalies,
        insights=insights,
        predicted_weekly_cost_eur=predicted_weekly_cost,
        predicted_weekly_protein=predicted_weekly_protein,
        predicted_avg_daily_calories=predicted_avg_calories,
        budget_risk=budget_risk,
        protein_goal_risk=protein_goal_risk,
        calorie_goal_risk=calorie_goal_risk,
    )
