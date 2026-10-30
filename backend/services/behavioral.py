from collections import defaultdict
from datetime import date, datetime, time, timedelta
from statistics import mean, pstdev

from sqlalchemy.orm import Session

from models.models import Meal, User
from schemas import BehaviourAnalyticsResponse, BehaviourDay, BehaviourInsight


def as_float(value) -> float:
    return float(value or 0)


def clamp(value: float, lower: float = 0, upper: float = 100) -> float:
    return max(lower, min(upper, value))


def calorie_score(calories: float, goal: float) -> float:
    if goal <= 0 or calories <= 0:
        return 0
    deviation = abs(calories - goal) / goal
    return round(clamp(100 - deviation * 140), 2)


def protein_score(protein: float, goal: float) -> float:
    if goal <= 0 or protein <= 0:
        return 0
    return round(clamp((protein / goal) * 100), 2)


def budget_score(cost: float, daily_budget: float) -> float:
    if daily_budget <= 0:
        return 100
    if cost <= daily_budget:
        return 100
    overrun_ratio = (cost - daily_budget) / daily_budget
    return round(clamp(100 - overrun_ratio * 120), 2)


def date_range(start: date, end: date) -> list[date]:
    days = []
    cursor = start
    while cursor <= end:
        days.append(cursor)
        cursor += timedelta(days=1)
    return days


def meal_is_late(meal: Meal) -> bool:
    if not meal.logged_at:
        return False
    hour = meal.logged_at.hour
    return hour >= 21 or hour < 4


def build_insights(
    consistency_score: float,
    protein_score_avg: float,
    budget_score_avg: float,
    calorie_spike_days: int,
    late_night_count: int,
    low_protein_days: int,
    overspending_days: int,
) -> list[BehaviourInsight]:
    insights: list[BehaviourInsight] = []

    if consistency_score >= 80:
        insights.append(
            BehaviourInsight(
                type="consistency",
                severity="positive",
                message="Meal logging is consistent across the selected period.",
            )
        )
    elif consistency_score < 45:
        insights.append(
            BehaviourInsight(
                type="consistency",
                severity="warning",
                message="Meal logging is inconsistent; analytics will improve when more days are tracked.",
            )
        )

    if protein_score_avg >= 85:
        insights.append(
            BehaviourInsight(
                type="protein",
                severity="positive",
                message="Protein adherence is strong relative to the current goal.",
            )
        )
    elif low_protein_days:
        insights.append(
            BehaviourInsight(
                type="protein",
                severity="warning",
                message=f"{low_protein_days} logged days were below 75% of the protein target.",
            )
        )

    if budget_score_avg < 75 or overspending_days:
        insights.append(
            BehaviourInsight(
                type="budget",
                severity="warning",
                message=f"{overspending_days} logged days exceeded the estimated daily budget.",
            )
        )
    elif budget_score_avg >= 90:
        insights.append(
            BehaviourInsight(
                type="budget",
                severity="positive",
                message="Food spending is staying comfortably within budget.",
            )
        )

    if calorie_spike_days:
        insights.append(
            BehaviourInsight(
                type="calorie_spike",
                severity="warning",
                message=f"{calorie_spike_days} days show unusually high calorie intake.",
            )
        )

    if late_night_count:
        insights.append(
            BehaviourInsight(
                type="late_meals",
                severity="info",
                message=f"{late_night_count} meals were logged late at night.",
            )
        )

    if not insights:
        insights.append(
            BehaviourInsight(
                type="baseline",
                severity="info",
                message="Not enough behavioural signal yet; keep logging meals to unlock stronger insights.",
            )
        )

    return insights


def analyse_behaviour(db: Session, user_id: int, days: int = 30) -> BehaviourAnalyticsResponse:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("User not found")

    days = max(7, min(days, 90))
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
    daily_budget = round(as_float(user.budget_weekly) / 7, 2) if as_float(user.budget_weekly) else 0

    logged_calories = [
        sum(as_float(meal.total_calories) for meal in day_meals)
        for day_meals in meals_by_day.values()
    ]
    calorie_avg = mean(logged_calories) if logged_calories else 0
    calorie_std = pstdev(logged_calories) if len(logged_calories) > 1 else 0
    spike_threshold = max(calorie_goal * 1.35 if calorie_goal else 0, calorie_avg + calorie_std * 1.5)

    daily_rows: list[BehaviourDay] = []
    calorie_scores: list[float] = []
    protein_scores: list[float] = []
    budget_scores: list[float] = []
    late_night_count = 0
    calorie_spike_days = 0
    overspending_days = 0
    low_protein_days = 0

    for current_date in date_range(period_start, period_end):
        day_meals = meals_by_day.get(current_date, [])
        calories = round(sum(as_float(meal.total_calories) for meal in day_meals), 2)
        protein = round(sum(as_float(meal.total_protein) for meal in day_meals), 2)
        carbs = round(sum(as_float(meal.total_carbs) for meal in day_meals), 2)
        fat = round(sum(as_float(meal.total_fat) for meal in day_meals), 2)
        cost = round(sum(as_float(meal.total_cost_eur) for meal in day_meals), 2)
        late_count = sum(1 for meal in day_meals if meal_is_late(meal))
        flags: list[str] = []

        c_score = calorie_score(calories, calorie_goal)
        p_score = protein_score(protein, protein_goal)
        b_score = budget_score(cost, daily_budget)

        if day_meals:
            calorie_scores.append(c_score)
            protein_scores.append(p_score)
            budget_scores.append(b_score)

        if calories and spike_threshold and calories > spike_threshold:
            flags.append("calorie_spike")
            calorie_spike_days += 1
        if daily_budget and cost > daily_budget:
            flags.append("overspending")
            overspending_days += 1
        if protein_goal and day_meals and protein < protein_goal * 0.75:
            flags.append("low_protein")
            low_protein_days += 1
        if late_count:
            flags.append("late_meal")
            late_night_count += late_count
        if day_meals and len(day_meals) < 2:
            flags.append("low_meal_frequency")

        daily_rows.append(
            BehaviourDay(
                date=current_date,
                calories=calories,
                protein=protein,
                carbs=carbs,
                fat=fat,
                cost_eur=cost,
                meal_count=len(day_meals),
                late_meal_count=late_count,
                calorie_adherence_score=c_score,
                protein_adherence_score=p_score,
                budget_adherence_score=b_score,
                flags=flags,
            )
        )

    days_logged = len(meals_by_day)
    meal_consistency_score = round((days_logged / days) * 100, 2) if days else 0
    calorie_adherence_avg = round(mean(calorie_scores), 2) if calorie_scores else 0
    protein_adherence_avg = round(mean(protein_scores), 2) if protein_scores else 0
    budget_adherence_avg = round(mean(budget_scores), 2) if budget_scores else 0
    overall_score = round(
        (
            meal_consistency_score * 0.30
            + calorie_adherence_avg * 0.20
            + protein_adherence_avg * 0.30
            + budget_adherence_avg * 0.20
        ),
        2,
    )

    insights = build_insights(
        meal_consistency_score,
        protein_adherence_avg,
        budget_adherence_avg,
        calorie_spike_days,
        late_night_count,
        low_protein_days,
        overspending_days,
    )

    return BehaviourAnalyticsResponse(
        user_id=user_id,
        period_start=period_start,
        period_end=period_end,
        days_considered=days,
        days_logged=days_logged,
        meal_count=len(meals),
        meal_consistency_score=meal_consistency_score,
        calorie_adherence_score=calorie_adherence_avg,
        protein_adherence_score=protein_adherence_avg,
        budget_adherence_score=budget_adherence_avg,
        overall_adherence_score=overall_score,
        late_night_meal_count=late_night_count,
        calorie_spike_days=calorie_spike_days,
        overspending_days=overspending_days,
        low_protein_days=low_protein_days,
        avg_calories_logged_day=round(mean(logged_calories), 2) if logged_calories else 0,
        avg_protein_logged_day=round(
            mean([row.protein for row in daily_rows if row.meal_count > 0]), 2
        )
        if days_logged
        else 0,
        avg_cost_logged_day=round(
            mean([row.cost_eur for row in daily_rows if row.meal_count > 0]), 2
        )
        if days_logged
        else 0,
        daily_budget_eur=daily_budget,
        insights=insights,
        daily=daily_rows,
    )
