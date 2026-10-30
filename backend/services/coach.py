from datetime import datetime, time, timedelta

from sqlalchemy.orm import Session

from models.models import Meal, Product, Recommendation, User
from schemas import (
    CoachAction,
    CoachAnswerResponse,
    CoachBriefingResponse,
    CoachMetricCard,
    CoachRiskFlag,
)
from services.behavioral import analyse_behaviour
from services.gamification import analyse_gamification
from services.predictive import analyse_predictive
from services.recommendations import generate_user_recommendations, protein_per_euro


def as_float(value) -> float:
    return float(value or 0)


def fmt_eur(value: float) -> str:
    return f"EUR {value:.2f}"


def fmt_num(value: float, digits: int = 0) -> str:
    return f"{value:.{digits}f}"


def status_for_ratio(value: float, target: float, lower: float = 0.8, upper: float = 1.2) -> str:
    if target <= 0:
        return "info"
    ratio = value / target
    if lower <= ratio <= upper:
        return "positive"
    if ratio < lower:
        return "warning"
    return "warning"


def todays_meals(db: Session, user_id: int) -> list[Meal]:
    today = datetime.now().date()
    start = datetime.combine(today, time.min)
    end = start + timedelta(days=1)
    return db.query(Meal).filter(
        Meal.user_id == user_id,
        Meal.logged_at >= start,
        Meal.logged_at < end,
    ).all()


def weekly_meals(db: Session, user_id: int) -> list[Meal]:
    today = datetime.now().date()
    start = datetime.combine(today - timedelta(days=6), time.min)
    return db.query(Meal).filter(Meal.user_id == user_id, Meal.logged_at >= start).all()


def get_recommendations(db: Session, user_id: int) -> list[Recommendation]:
    recommendations = (
        db.query(Recommendation)
        .filter(Recommendation.user_id == user_id)
        .order_by(Recommendation.created_at.desc(), Recommendation.id.desc())
        .limit(10)
        .all()
    )
    if recommendations:
        return recommendations
    return generate_user_recommendations(db, user_id)


def best_efficiency_product(db: Session) -> Product | None:
    products = db.query(Product).filter(
        Product.estimated_price_eur.isnot(None),
        Product.protein_per_100g.isnot(None),
    ).all()
    products = [product for product in products if protein_per_euro(product) > 0]
    if not products:
        return None
    return sorted(products, key=protein_per_euro, reverse=True)[0]


def build_summary_cards(
    today_calories: float,
    today_protein: float,
    today_cost: float,
    user: User,
    weekly_spend: float,
    behaviour_score: float,
    predicted_weekly_cost: float,
    momentum_score: int,
) -> list[CoachMetricCard]:
    calorie_goal = as_float(user.calorie_goal)
    protein_goal = as_float(user.protein_goal)
    budget = as_float(user.budget_weekly)
    daily_budget = budget / 7 if budget else 0

    return [
        CoachMetricCard(
            label="Today calories",
            value=f"{fmt_num(today_calories)} kcal",
            detail=f"Goal {fmt_num(calorie_goal)} kcal",
            status=status_for_ratio(today_calories, calorie_goal),
        ),
        CoachMetricCard(
            label="Today protein",
            value=f"{fmt_num(today_protein, 1)} g",
            detail=f"Goal {fmt_num(protein_goal)} g",
            status="positive" if protein_goal and today_protein >= protein_goal * 0.8 else "warning",
        ),
        CoachMetricCard(
            label="Today spend",
            value=fmt_eur(today_cost),
            detail=f"Daily budget {fmt_eur(daily_budget)}",
            status="positive" if not daily_budget or today_cost <= daily_budget else "warning",
        ),
        CoachMetricCard(
            label="Weekly spend",
            value=fmt_eur(weekly_spend),
            detail=f"Forecast {fmt_eur(predicted_weekly_cost)}",
            status="positive" if not budget or predicted_weekly_cost <= budget else "warning",
        ),
        CoachMetricCard(
            label="Adherence",
            value=f"{fmt_num(behaviour_score)}%",
            detail="Behavioural score",
            status="positive" if behaviour_score >= 70 else "warning",
        ),
        CoachMetricCard(
            label="Momentum",
            value=str(momentum_score),
            detail="Gamification score",
            status="positive" if momentum_score >= 100 else "info",
        ),
    ]


def build_actions(
    db: Session,
    user: User,
    today_protein: float,
    today_calories: float,
    today_cost: float,
    weekly_spend: float,
    behaviour,
    predictive,
    gamification,
    recommendations: list[Recommendation],
) -> list[CoachAction]:
    actions: list[CoachAction] = []
    protein_goal = as_float(user.protein_goal)
    calorie_goal = as_float(user.calorie_goal)
    weekly_budget = as_float(user.budget_weekly)
    daily_budget = weekly_budget / 7 if weekly_budget else 0
    best_product = best_efficiency_product(db)

    if protein_goal and today_protein < protein_goal * 0.75:
        product_hint = f" Add {best_product.name} as the cheapest high-protein anchor." if best_product else ""
        actions.append(
            CoachAction(
                title="Close the protein gap",
                rationale=f"Today is {fmt_num(protein_goal - today_protein, 1)}g below the protein target.",
                impact="Improves satiety and goal adherence without needing a full meal rebuild.",
                category="nutrition",
                priority=5,
            )
        )
        if product_hint:
            actions[-1].impact += product_hint

    if calorie_goal and today_calories < calorie_goal * 0.65:
        actions.append(
            CoachAction(
                title="Add a balanced meal block",
                rationale="Calories are far below the current goal, which can make the forecast look artificially weak.",
                impact="Brings the day closer to target while giving the analytics better signal.",
                category="nutrition",
                priority=4,
            )
        )
    elif calorie_goal and today_calories > calorie_goal * 1.2:
        actions.append(
            CoachAction(
                title="Keep the next meal lighter",
                rationale="Calories are tracking above the target band today.",
                impact="Protects adherence without changing the full weekly plan.",
                category="nutrition",
                priority=4,
            )
        )

    if weekly_budget and predictive.budget_risk:
        actions.append(
            CoachAction(
                title="Rebuild one upcoming meal around protein-per-euro",
                rationale=f"Projected weekly spend is {fmt_eur(predictive.predicted_weekly_cost_eur)} against a {fmt_eur(weekly_budget)} budget.",
                impact="Reduces budget risk while keeping protein quality visible.",
                category="budget",
                priority=5,
            )
        )
    elif daily_budget and today_cost > daily_budget:
        actions.append(
            CoachAction(
                title="Use a low-cost dinner anchor",
                rationale=f"Today spend is above the estimated daily budget of {fmt_eur(daily_budget)}.",
                impact="Keeps the weekly budget from drifting after one expensive day.",
                category="budget",
                priority=4,
            )
        )
    elif weekly_budget and weekly_spend < weekly_budget * 0.75:
        actions.append(
            CoachAction(
                title="Protect the budget pattern",
                rationale="Current spend is still comfortably below the weekly budget.",
                impact="Use saved efficient products before adding new premium items.",
                category="budget",
                priority=2,
            )
        )

    if behaviour.meal_consistency_score < 50:
        actions.append(
            CoachAction(
                title="Log one meal today",
                rationale="Consistency is the weakest signal in the current analytics window.",
                impact="Improves forecast confidence, streaks, and recommendation quality.",
                category="behaviour",
                priority=4,
            )
        )

    if gamification.current_logging_streak == 0 and gamification.best_logging_streak >= 3:
        actions.append(
            CoachAction(
                title="Restart the streak",
                rationale=f"The best logging streak is {gamification.best_logging_streak} days, but the current streak is inactive.",
                impact="Recovers momentum and keeps weekly challenges achievable.",
                category="engagement",
                priority=3,
            )
        )

    for recommendation in recommendations[:2]:
        actions.append(
            CoachAction(
                title="Apply recommendation",
                rationale=recommendation.message,
                impact="Turns the recommendation engine into a concrete next step.",
                category=recommendation.type or "recommendation",
                priority=3,
            )
        )

    if not actions:
        actions.append(
            CoachAction(
                title="Maintain the current plan",
                rationale="Nutrition, budget, and behaviour signals are not showing urgent risk.",
                impact="Keep logging and let the dashboard collect a stronger baseline.",
                category="baseline",
                priority=1,
            )
        )

    return sorted(actions, key=lambda action: action.priority, reverse=True)[:6]


def build_risks(behaviour, predictive, gamification) -> list[CoachRiskFlag]:
    risks: list[CoachRiskFlag] = []

    if predictive.protein_goal_risk:
        risks.append(
            CoachRiskFlag(
                type="protein_forecast",
                severity="warning",
                message="Forecast protein is below the current goal band.",
            )
        )
    if predictive.calorie_goal_risk:
        risks.append(
            CoachRiskFlag(
                type="calorie_forecast",
                severity="warning",
                message="Forecast calories are outside the target band.",
            )
        )
    if predictive.budget_risk:
        risks.append(
            CoachRiskFlag(
                type="budget_forecast",
                severity="warning",
                message="Forecast spend is above the weekly budget.",
            )
        )
    if behaviour.low_protein_days:
        risks.append(
            CoachRiskFlag(
                type="low_protein_days",
                severity="warning",
                message=f"{behaviour.low_protein_days} logged days were low-protein in the selected period.",
            )
        )
    if gamification.current_logging_streak == 0 and gamification.logged_days:
        risks.append(
            CoachRiskFlag(
                type="logging_momentum",
                severity="info",
                message="The current logging streak is inactive.",
            )
        )

    if not risks:
        risks.append(
            CoachRiskFlag(
                type="baseline",
                severity="positive",
                message="No major nutrition, budget, or logging risks are active.",
            )
        )

    return risks


def focus_from_signals(actions: list[CoachAction], risks: list[CoachRiskFlag]) -> str:
    if any(action.category == "nutrition" and action.priority >= 4 for action in actions):
        return "nutrition"
    if any("budget" in risk.type for risk in risks):
        return "budget"
    if any(action.category == "behaviour" for action in actions):
        return "consistency"
    if any(action.category == "engagement" for action in actions):
        return "momentum"
    return "maintenance"


def readiness_score(behaviour, predictive, gamification) -> int:
    score = 50
    score += min(20, int(behaviour.overall_adherence_score * 0.2))
    score += min(15, gamification.current_logging_streak * 5)
    score += 10 if not predictive.budget_risk else -10
    score += 10 if not predictive.protein_goal_risk else -12
    score += 5 if not predictive.calorie_goal_risk else -8
    return max(0, min(100, score))


def data_quality_notes(behaviour, predictive, gamification) -> list[str]:
    notes: list[str] = []
    if behaviour.days_logged < 5:
        notes.append("Fewer than 5 logged days are available, so coaching confidence is still limited.")
    if predictive.model_type == "local_average_baseline_v1":
        notes.append("Forecasting is using an average baseline until more consistent logs are available.")
    if gamification.logged_days == 0:
        notes.append("Gamified insights need meal logs before streaks and badges become meaningful.")
    if not notes:
        notes.append("Data coverage is strong enough for a practical weekly coaching brief.")
    return notes


def build_talking_points(actions: list[CoachAction], risks: list[CoachRiskFlag]) -> list[str]:
    points = [
        "What is the cheapest way to close today's protein gap?",
        "Which saved products should I build tomorrow around?",
        "How can I stay under budget this week?",
    ]
    if any(action.category == "engagement" for action in actions):
        points.append("What should I log today to restart momentum?")
    if any(risk.type == "calorie_forecast" for risk in risks):
        points.append("Why is my calorie forecast outside the target band?")
    return points[:4]


def generate_coach_briefing(
    db: Session,
    user_id: int,
    days: int = 30,
) -> CoachBriefingResponse:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("User not found")

    days = max(7, min(days, 90))
    today = todays_meals(db, user_id)
    week = weekly_meals(db, user_id)
    today_calories = sum(as_float(meal.total_calories) for meal in today)
    today_protein = sum(as_float(meal.total_protein) for meal in today)
    today_cost = sum(as_float(meal.total_cost_eur) for meal in today)
    weekly_spend = sum(as_float(meal.total_cost_eur) for meal in week)

    behaviour = analyse_behaviour(db, user_id, days)
    predictive = analyse_predictive(db, user_id, days, 7)
    gamification = analyse_gamification(db, user_id, days)
    recommendations = get_recommendations(db, user_id)

    actions = build_actions(
        db,
        user,
        today_protein,
        today_calories,
        today_cost,
        weekly_spend,
        behaviour,
        predictive,
        gamification,
        recommendations,
    )
    risks = build_risks(behaviour, predictive, gamification)
    focus = focus_from_signals(actions, risks)
    score = readiness_score(behaviour, predictive, gamification)
    headline = (
        f"Focus on {focus}: {actions[0].title.lower()}."
        if actions
        else "Keep logging and maintain the current plan."
    )

    return CoachBriefingResponse(
        user_id=user_id,
        generated_at=datetime.now(),
        focus_area=focus,
        headline=headline,
        readiness_score=score,
        summary_cards=build_summary_cards(
            today_calories=today_calories,
            today_protein=today_protein,
            today_cost=today_cost,
            user=user,
            weekly_spend=weekly_spend,
            behaviour_score=behaviour.overall_adherence_score,
            predicted_weekly_cost=predictive.predicted_weekly_cost_eur,
            momentum_score=gamification.score,
        ),
        action_plan=actions,
        risk_flags=risks,
        talking_points=build_talking_points(actions, risks),
        data_quality_notes=data_quality_notes(behaviour, predictive, gamification),
    )


def answer_coach_question(
    db: Session,
    user_id: int,
    question: str,
    days: int = 30,
) -> CoachAnswerResponse:
    briefing = generate_coach_briefing(db, user_id, days)
    question_lc = question.lower()

    if "budget" in question_lc or "cost" in question_lc or "spend" in question_lc:
        budget_actions = [action for action in briefing.action_plan if action.category == "budget"]
        answer = (
            "Budget looks manageable right now, but keep upcoming meals anchored on high protein-per-euro products."
            if not budget_actions
            else budget_actions[0].rationale + " " + budget_actions[0].impact
        )
        actions = budget_actions or briefing.action_plan[:2]
        sources = ["weekly spend", "predictive budget forecast", "recommendation engine"]
    elif "protein" in question_lc:
        protein_actions = [action for action in briefing.action_plan if action.category == "nutrition"]
        answer = (
            "Protein is the main nutrition lever to watch. Prioritise the highest protein-per-euro foods before adding extras."
            if not protein_actions
            else protein_actions[0].rationale + " " + protein_actions[0].impact
        )
        actions = protein_actions or briefing.action_plan[:2]
        sources = ["daily protein", "protein forecast", "efficiency rankings"]
    elif "streak" in question_lc or "badge" in question_lc or "momentum" in question_lc:
        engagement_actions = [
            action for action in briefing.action_plan if action.category in {"engagement", "behaviour"}
        ]
        answer = "The fastest momentum win is to log one accurate meal today and keep weekly challenges moving."
        actions = engagement_actions or briefing.action_plan[:2]
        sources = ["gamification score", "logging streaks", "weekly challenges"]
    else:
        answer = briefing.headline
        actions = briefing.action_plan[:3]
        sources = ["coach briefing", "behaviour analytics", "predictive analytics", "recommendations"]

    return CoachAnswerResponse(
        user_id=user_id,
        question=question,
        answer=answer,
        suggested_actions=actions[:3],
        sources=sources,
    )
