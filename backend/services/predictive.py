from collections import defaultdict
from datetime import date, datetime, time, timedelta
from statistics import mean, pstdev

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


def linear_prediction(
    indexed_values: list[tuple[int, float]],
    target_index: int,
    fallback: float,
    upper: float | None = None,
) -> float:
    if len(indexed_values) < 3:
        return round(clamp(fallback, upper=upper), 2)

    xs = [point[0] for point in indexed_values]
    ys = [point[1] for point in indexed_values]
    x_avg = mean(xs)
    y_avg = mean(ys)
    denominator = sum((x - x_avg) ** 2 for x in xs)
    if denominator == 0:
        return round(clamp(fallback, upper=upper), 2)

    slope = sum((x - x_avg) * (y - y_avg) for x, y in indexed_values) / denominator
    intercept = y_avg - slope * x_avg
    trend_value = intercept + slope * target_index

    # Blend the trend with the logged-day average so a tiny demo dataset does not swing wildly.
    blended = (trend_value * 0.55) + (fallback * 0.45)
    return round(clamp(blended, upper=upper), 2)


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
    proteins = [point[2] for point in logged_points]
    costs = [point[3] for point in logged_points]

    calorie_avg = mean(calories)
    calorie_std = pstdev(calories) if len(calories) > 1 else 0
    cost_avg = mean(costs)
    cost_std = pstdev(costs) if len(costs) > 1 else 0

    calorie_high_threshold = max(
        calorie_goal * 1.30 if calorie_goal else 0,
        calorie_avg + max(calorie_std * 1.75, 250),
    )
    calorie_low_threshold = calorie_goal * 0.50 if calorie_goal else 0
    cost_threshold = (
        daily_budget * 1.25
        if daily_budget
        else cost_avg + max(cost_std * 1.75, 2.5)
    )
    protein_low_threshold = protein_goal * 0.65 if protein_goal else 0

    for point_date, calorie_value, protein_value, cost_value in logged_points:
        if calorie_high_threshold and calorie_value > calorie_high_threshold:
            anomalies.append(
                PredictiveAnomaly(
                    date=point_date,
                    metric="calories",
                    value=round(calorie_value, 2),
                    expected_value=round(calorie_avg, 2),
                    severity="warning",
                    message="Calorie intake is materially above the recent baseline.",
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

        if cost_threshold and cost_value > cost_threshold:
            anomalies.append(
                PredictiveAnomaly(
                    date=point_date,
                    metric="cost",
                    value=round(cost_value, 2),
                    expected_value=round(daily_budget or cost_avg, 2),
                    severity="warning",
                    message="Food spend is above the expected daily baseline.",
                )
            )

    return anomalies[:10]


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
    indexed_calories: list[tuple[int, float]] = []
    indexed_protein: list[tuple[int, float]] = []
    indexed_cost: list[tuple[int, float]] = []

    for index, current_date in enumerate(date_range(period_start, period_end)):
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
            indexed_calories.append((index, calories))
            indexed_protein.append((index, protein))
            indexed_cost.append((index, cost))

    calories_avg = mean([point[1] for point in logged_points]) if logged_points else 0
    protein_avg = mean([point[2] for point in logged_points]) if logged_points else 0
    cost_avg = mean([point[3] for point in logged_points]) if logged_points else 0

    calories_upper = max(calorie_goal * 1.8, calories_avg * 2.4, 500) if calories_avg or calorie_goal else None
    protein_upper = max(protein_goal * 1.8, protein_avg * 2.4, 50) if protein_avg or protein_goal else None
    cost_upper = max(daily_budget * 2.5, cost_avg * 2.5, 10) if cost_avg or daily_budget else None

    trend_ready = len(logged_points) >= 7 and (len(logged_points) / days) >= 0.45
    calorie_series = indexed_calories if trend_ready else []
    protein_series = indexed_protein if trend_ready else []
    cost_series = indexed_cost if trend_ready else []

    forecast: list[PredictiveForecastPoint] = []
    for offset in range(1, horizon + 1):
        target_index = days - 1 + offset
        forecast_date = period_end + timedelta(days=offset)
        forecast.append(
            PredictiveForecastPoint(
                date=forecast_date,
                calories=linear_prediction(calorie_series, target_index, calories_avg, calories_upper),
                protein=linear_prediction(protein_series, target_index, protein_avg, protein_upper),
                cost_eur=linear_prediction(cost_series, target_index, cost_avg, cost_upper),
            )
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
        model_type="local_linear_trend_v1" if trend_ready else "local_average_baseline_v1",
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
