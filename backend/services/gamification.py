from collections import defaultdict
from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session

from models.models import Meal, User
from schemas import (
    GamificationAnalyticsResponse,
    GamificationBadge,
    GamificationChallenge,
    GamificationDay,
    GamificationInsight,
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


def current_streak(flags: list[bool]) -> int:
    streak = 0
    for flag in reversed(flags):
        if not flag:
            break
        streak += 1
    return streak


def best_streak(flags: list[bool]) -> int:
    best = 0
    current = 0
    for flag in flags:
        if flag:
            current += 1
            best = max(best, current)
        else:
            current = 0
    return best


def recent_streak(flags: list[bool]) -> int:
    last_true = None
    for index in range(len(flags) - 1, -1, -1):
        if flags[index]:
            last_true = index
            break
    if last_true is None:
        return 0

    streak = 0
    for index in range(last_true, -1, -1):
        if not flags[index]:
            break
        streak += 1
    return streak


def progress_badge(
    badge_id: str,
    title: str,
    description: str,
    category: str,
    level: str,
    progress: float,
    target: float,
) -> GamificationBadge:
    return GamificationBadge(
        id=badge_id,
        title=title,
        description=description,
        category=category,
        level=level,
        earned=progress >= target,
        progress=round(min(progress, target), 2),
        target=target,
    )


def build_badges(
    logged_days: int,
    best_logging: int,
    budget_days: int,
    protein_days: int,
    calorie_days: int,
    score: int,
) -> list[GamificationBadge]:
    return [
        progress_badge(
            "first-log",
            "First log",
            "Log your first meal day.",
            "logging",
            "bronze",
            logged_days,
            1,
        ),
        progress_badge(
            "three-day-rhythm",
            "Three-day rhythm",
            "Build a 3-day logging streak.",
            "consistency",
            "bronze",
            best_logging,
            3,
        ),
        progress_badge(
            "weekly-builder",
            "Weekly builder",
            "Log meals on 5 days in the selected period.",
            "consistency",
            "silver",
            logged_days,
            5,
        ),
        progress_badge(
            "budget-keeper",
            "Budget keeper",
            "Stay under the daily budget on 3 logged days.",
            "budget",
            "silver",
            budget_days,
            3,
        ),
        progress_badge(
            "protein-builder",
            "Protein builder",
            "Reach at least 80% of the protein goal on 3 days.",
            "nutrition",
            "silver",
            protein_days,
            3,
        ),
        progress_badge(
            "balanced-day",
            "Balanced day",
            "Hit calorie, protein, and budget targets on the same day.",
            "nutrition",
            "gold",
            min(calorie_days, protein_days, budget_days),
            1,
        ),
        progress_badge(
            "momentum-300",
            "Momentum 300",
            "Earn 300 momentum points in the selected period.",
            "momentum",
            "gold",
            score,
            300,
        ),
    ]


def build_challenges(
    days: list[GamificationDay],
    period_end: date,
) -> list[GamificationChallenge]:
    week_start = period_end - timedelta(days=period_end.weekday())
    week_end = week_start + timedelta(days=6)
    week_days = [day for day in days if week_start <= day.date <= week_end]
    logged_this_week = sum(1 for day in week_days if day.meal_count > 0)
    protein_this_week = sum(1 for day in week_days if day.protein_met)
    budget_this_week = sum(1 for day in week_days if day.budget_met)
    meals_this_week = sum(day.meal_count for day in week_days)

    return [
        GamificationChallenge(
            id="log-5-days",
            title="5-day logging week",
            description="Log meals on 5 days this week.",
            progress=min(logged_this_week, 5),
            target=5,
            unit="days",
            reward_points=60,
            expires_on=week_end,
        ),
        GamificationChallenge(
            id="protein-3-days",
            title="Protein focus",
            description="Reach the protein target on 3 days this week.",
            progress=min(protein_this_week, 3),
            target=3,
            unit="days",
            reward_points=50,
            expires_on=week_end,
        ),
        GamificationChallenge(
            id="budget-5-days",
            title="Budget control",
            description="Stay within daily budget on 5 logged days this week.",
            progress=min(budget_this_week, 5),
            target=5,
            unit="days",
            reward_points=50,
            expires_on=week_end,
        ),
        GamificationChallenge(
            id="meal-10",
            title="10 tracked meals",
            description="Track 10 meals this week.",
            progress=min(meals_this_week, 10),
            target=10,
            unit="meals",
            reward_points=40,
            expires_on=week_end,
        ),
    ]


def build_insights(
    logged_days: int,
    current_logging: int,
    best_logging: int,
    budget_streak: int,
    protein_days: int,
    earned_badges: int,
    challenges: list[GamificationChallenge],
) -> list[GamificationInsight]:
    insights: list[GamificationInsight] = []

    if current_logging >= 3:
        insights.append(
            GamificationInsight(
                type="streak",
                severity="positive",
                message=f"Current logging streak is {current_logging} days.",
            )
        )
    elif best_logging >= 3:
        insights.append(
            GamificationInsight(
                type="streak",
                severity="info",
                message=f"Best logging streak is {best_logging} days; logging today restarts momentum.",
            )
        )
    elif logged_days:
        insights.append(
            GamificationInsight(
                type="streak",
                severity="info",
                message="A 3-day logging streak will unlock the next consistency badge.",
            )
        )

    if budget_streak >= 3:
        insights.append(
            GamificationInsight(
                type="budget",
                severity="positive",
                message=f"Budget-friendly streak is {budget_streak} logged days.",
            )
        )

    if protein_days == 0 and logged_days:
        insights.append(
            GamificationInsight(
                type="protein",
                severity="warning",
                message="No logged day reached 80% of the protein goal yet.",
            )
        )

    almost_done = [
        challenge
        for challenge in challenges
        if challenge.progress < challenge.target and challenge.progress >= challenge.target * 0.6
    ]
    if almost_done:
        challenge = almost_done[0]
        remaining = challenge.target - challenge.progress
        insights.append(
            GamificationInsight(
                type="challenge",
                severity="info",
                message=f"{challenge.title} needs {remaining:g} more {challenge.unit}.",
            )
        )

    if earned_badges:
        insights.append(
            GamificationInsight(
                type="badges",
                severity="positive",
                message=f"{earned_badges} badges are currently unlocked.",
            )
        )

    if not insights:
        insights.append(
            GamificationInsight(
                type="baseline",
                severity="info",
                message="Log meals consistently to unlock streaks, badges, and weekly challenges.",
            )
        )

    return insights


def analyse_gamification(
    db: Session,
    user_id: int,
    days: int = 30,
) -> GamificationAnalyticsResponse:
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
    daily_budget = as_float(user.budget_weekly) / 7 if as_float(user.budget_weekly) else 0

    daily_rows: list[GamificationDay] = []
    logging_flags: list[bool] = []
    budget_flags: list[bool] = []
    protein_flags: list[bool] = []
    calorie_flags: list[bool] = []

    for current_date in date_range(period_start, period_end):
        day_meals = meals_by_day.get(current_date, [])
        calories = sum(as_float(meal.total_calories) for meal in day_meals)
        protein = sum(as_float(meal.total_protein) for meal in day_meals)
        cost = sum(as_float(meal.total_cost_eur) for meal in day_meals)
        logged = len(day_meals) > 0
        budget_met = bool(logged and (daily_budget <= 0 or cost <= daily_budget))
        protein_met = bool(logged and protein_goal > 0 and protein >= protein_goal * 0.8)
        calorie_met = bool(
            logged
            and calorie_goal > 0
            and calorie_goal * 0.8 <= calories <= calorie_goal * 1.2
        )

        score = 0
        if logged:
            score += 30
        if budget_met:
            score += 25
        if protein_met:
            score += 25
        if calorie_met:
            score += 20

        daily_rows.append(
            GamificationDay(
                date=current_date,
                score=score,
                meal_count=len(day_meals),
                budget_met=budget_met,
                protein_met=protein_met,
                calorie_met=calorie_met,
            )
        )
        logging_flags.append(logged)
        budget_flags.append(budget_met)
        protein_flags.append(protein_met)
        calorie_flags.append(calorie_met)

    logged_days = sum(1 for flag in logging_flags if flag)
    meal_count = len(meals)
    budget_days = sum(1 for flag in budget_flags if flag)
    protein_days = sum(1 for flag in protein_flags if flag)
    calorie_days = sum(1 for flag in calorie_flags if flag)
    current_logging = current_streak(logging_flags)
    best_logging = best_streak(logging_flags)
    budget_streak = recent_streak(budget_flags)

    score = int(
        logged_days * 8
        + meal_count * 3
        + budget_days * 10
        + protein_days * 12
        + calorie_days * 8
        + best_logging * 5
    )
    level = max(1, score // 100 + 1)
    next_level_score = level * 100

    badges = build_badges(
        logged_days=logged_days,
        best_logging=best_logging,
        budget_days=budget_days,
        protein_days=protein_days,
        calorie_days=calorie_days,
        score=score,
    )
    challenges = build_challenges(daily_rows, period_end)
    insights = build_insights(
        logged_days=logged_days,
        current_logging=current_logging,
        best_logging=best_logging,
        budget_streak=budget_streak,
        protein_days=protein_days,
        earned_badges=sum(1 for badge in badges if badge.earned),
        challenges=challenges,
    )

    return GamificationAnalyticsResponse(
        user_id=user_id,
        period_start=period_start,
        period_end=period_end,
        score=score,
        level=level,
        next_level_score=next_level_score,
        logged_days=logged_days,
        meal_count=meal_count,
        current_logging_streak=current_logging,
        best_logging_streak=best_logging,
        budget_streak_days=budget_streak,
        protein_target_days=protein_days,
        calorie_target_days=calorie_days,
        badges=badges,
        challenges=challenges,
        insights=insights,
        daily=daily_rows,
    )
