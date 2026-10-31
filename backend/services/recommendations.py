from datetime import datetime, time, timedelta
from statistics import median

from sqlalchemy.orm import Session

from models.models import Meal, Product, Recommendation, User

GENERATED_TYPES = {
    "substitution",
    "expensive_food",
    "budget_alert",
    "protein_alert",
    "efficiency_tip",
}


def as_float(value) -> float:
    return float(value or 0)


def cost_per_100g(product: Product) -> float | None:
    price = as_float(product.estimated_price_eur)
    serving_size = as_float(product.serving_size_g)
    if price <= 0 or serving_size <= 0:
        return None
    return price / serving_size * 100


def protein_per_euro(product: Product) -> float:
    cost = cost_per_100g(product)
    protein = as_float(product.protein_per_100g)
    if not cost or cost <= 0:
        return 0
    return protein / cost


def estimate_serving_savings(source: Product, suggested: Product) -> float:
    source_cost = cost_per_100g(source)
    suggested_cost = cost_per_100g(suggested)
    serving_size = as_float(source.serving_size_g) or 100
    if source_cost is None or suggested_cost is None:
        return 0
    savings = (source_cost - suggested_cost) * (serving_size / 100)
    return max(round(savings, 2), 0)


def weekly_meals(db: Session, user_id: int) -> list[Meal]:
    today = datetime.now().date()
    week_start = datetime.combine(today - timedelta(days=6), time.min)
    return db.query(Meal).filter(Meal.user_id == user_id, Meal.logged_at >= week_start).all()


def todays_meals(db: Session, user_id: int) -> list[Meal]:
    today = datetime.now().date()
    start = datetime.combine(today, time.min)
    end = start + timedelta(days=1)
    return db.query(Meal).filter(
        Meal.user_id == user_id,
        Meal.logged_at >= start,
        Meal.logged_at < end,
    ).all()


def add_recommendation(
    recommendations: list[Recommendation],
    user_id: int,
    rec_type: str,
    message: str,
    source_product_id: int | None = None,
    suggested_product_id: int | None = None,
    savings_eur: float | None = None,
) -> None:
    recommendations.append(
        Recommendation(
            user_id=user_id,
            type=rec_type,
            message=message,
            source_product_id=source_product_id,
            suggested_product_id=suggested_product_id,
            savings_eur=savings_eur,
        )
    )


def generate_user_recommendations(db: Session, user_id: int) -> list[Recommendation]:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return []

    db.query(Recommendation).filter(
        Recommendation.user_id == user_id,
        Recommendation.type.in_(GENERATED_TYPES),
    ).delete(synchronize_session=False)

    recommendations: list[Recommendation] = []
    products = db.query(Product).filter(Product.estimated_price_eur.isnot(None)).all()
    priced_products = [product for product in products if cost_per_100g(product) is not None]

    generate_substitution_recommendations(recommendations, user_id, priced_products)
    generate_expensive_food_recommendations(recommendations, user_id, priced_products)
    generate_budget_recommendation(db, recommendations, user)
    generate_protein_recommendation(db, recommendations, user, priced_products)
    generate_efficiency_tip(recommendations, user_id, priced_products)

    for recommendation in recommendations:
        db.add(recommendation)
    db.commit()

    return (
        db.query(Recommendation)
        .filter(Recommendation.user_id == user_id)
        .order_by(Recommendation.created_at.desc(), Recommendation.id.desc())
        .limit(20)
        .all()
    )


def generate_substitution_recommendations(
    recommendations: list[Recommendation],
    user_id: int,
    products: list[Product],
) -> None:
    substitutions = []
    for source in products:
        source_cost = cost_per_100g(source)
        source_protein = as_float(source.protein_per_100g)
        if source_cost is None or source_protein < 8:
            continue

        same_category = [
            product
            for product in products
            if product.id != source.id
            and (product.category or "").lower() == (source.category or "").lower()
            and as_float(product.protein_per_100g) >= source_protein * 0.75
        ]
        candidates = same_category or [
            product
            for product in products
            if product.id != source.id and as_float(product.protein_per_100g) >= source_protein * 0.75
        ]

        cheaper = [
            product
            for product in candidates
            if (cost_per_100g(product) or 999999) < source_cost * 0.85
            and protein_per_euro(product) > protein_per_euro(source)
        ]
        if not cheaper:
            continue

        suggested = sorted(cheaper, key=protein_per_euro, reverse=True)[0]
        savings = estimate_serving_savings(source, suggested)
        substitutions.append((savings, source, suggested))

    for savings, source, suggested in sorted(substitutions, key=lambda item: item[0], reverse=True)[:5]:
        if savings <= 0:
            continue
        add_recommendation(
            recommendations,
            user_id,
            "substitution",
            (
                f"Swap {source.name} for {suggested.name} to save about "
                f"EUR {savings:.2f} per serving while keeping protein density strong."
            ),
            source_product_id=source.id,
            suggested_product_id=suggested.id,
            savings_eur=savings,
        )


def generate_expensive_food_recommendations(
    recommendations: list[Recommendation],
    user_id: int,
    products: list[Product],
) -> None:
    costs = [cost_per_100g(product) for product in products]
    costs = [cost for cost in costs if cost is not None]
    if len(costs) < 3:
        return

    median_cost = median(costs)
    expensive_low_protein = [
        product
        for product in products
        if (cost_per_100g(product) or 0) > median_cost * 1.4
        and as_float(product.protein_per_100g) < 8
    ]

    for product in sorted(expensive_low_protein, key=lambda item: cost_per_100g(item) or 0, reverse=True)[:3]:
        add_recommendation(
            recommendations,
            user_id,
            "expensive_food",
            (
                f"{product.name} is relatively expensive for its protein return. "
                "Consider reserving it for taste or convenience rather than core meal-prep protein."
            ),
            source_product_id=product.id,
            savings_eur=0,
        )


def generate_budget_recommendation(
    db: Session,
    recommendations: list[Recommendation],
    user: User,
) -> None:
    meals = weekly_meals(db, user.id)
    weekly_spend = sum(as_float(meal.total_cost_eur) for meal in meals)
    budget = as_float(user.budget_weekly)
    if budget <= 0 or not meals:
        return

    if weekly_spend > budget:
        overspend = round(weekly_spend - budget, 2)
        add_recommendation(
            recommendations,
            user.id,
            "budget_alert",
            (
                f"You are EUR {overspend:.2f} over your weekly food budget. "
                "Use the efficiency rankings to rebuild one meal around lower-cost protein."
            ),
            savings_eur=overspend,
        )
    elif weekly_spend > budget * 0.8:
        remaining = round(budget - weekly_spend, 2)
        add_recommendation(
            recommendations,
            user.id,
            "budget_alert",
            (
                f"You have EUR {remaining:.2f} left this week. "
                "Keep upcoming meals anchored on your highest protein-per-euro foods."
            ),
            savings_eur=0,
        )


def generate_protein_recommendation(
    db: Session,
    recommendations: list[Recommendation],
    user: User,
    products: list[Product],
) -> None:
    meals = todays_meals(db, user.id)
    protein = sum(as_float(meal.total_protein) for meal in meals)
    target = as_float(user.protein_goal)
    if target <= 0 or not meals or protein >= target * 0.75:
        return

    shortfall = target - protein
    best_product = sorted(products, key=protein_per_euro, reverse=True)[0] if products else None
    suggestion = f" Add {best_product.name} to close the gap cheaply." if best_product else ""
    add_recommendation(
        recommendations,
        user.id,
        "protein_alert",
        f"You are {shortfall:.1f}g below today's protein target.{suggestion}",
        suggested_product_id=best_product.id if best_product else None,
        savings_eur=0,
    )


def generate_efficiency_tip(
    recommendations: list[Recommendation],
    user_id: int,
    products: list[Product],
) -> None:
    if not products:
        return

    best = sorted(products, key=protein_per_euro, reverse=True)[0]
    add_recommendation(
        recommendations,
        user_id,
        "efficiency_tip",
        (
            f"{best.name} is currently your best protein-per-euro product. "
            "Use it as a default building block when meal cost starts creeping up."
        ),
        suggested_product_id=best.id,
        savings_eur=0,
    )
