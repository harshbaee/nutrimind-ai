from dataclasses import dataclass

from ortools.sat.python import cp_model
from sqlalchemy.orm import Session

from models.models import Product, User
from schemas import (
    OptimizationRequest,
    OptimizationResponse,
    OptimizedMeal,
    OptimizedPlanItem,
    OptimizedPlanTotals,
    ShoppingListItem,
)

UNIT_G = 50
SCALE = 100
MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "extra"]


@dataclass
class ProductCandidate:
    product: Product
    calories: int
    protein: int
    carbs: int
    fat: int
    cost: int
    max_units: int


def as_float(value) -> float:
    return float(value or 0)


def cost_per_100g(product: Product) -> float:
    price = as_float(product.estimated_price_eur)
    serving = as_float(product.serving_size_g)
    if price <= 0 or serving <= 0:
        return 0
    return price / serving * 100


def protein_efficiency(product: Product) -> float:
    cost = cost_per_100g(product)
    if cost <= 0:
        return 0
    return round(as_float(product.protein_per_100g) / cost, 2)


def preference_exclusions(preference: str) -> set[str]:
    normalized = preference.lower().strip()
    if normalized in {"vegetarian", "veggie"}:
        return {"meat", "fish", "seafood", "poultry"}
    if normalized in {"vegan", "plant-based", "plant based"}:
        return {"meat", "fish", "seafood", "poultry", "dairy", "eggs"}
    return set()


def product_allowed(product: Product, preference: str) -> bool:
    excluded = preference_exclusions(preference)
    if not excluded:
        return True

    category = (product.category or "").lower()
    name = (product.name or "").lower()
    text = f"{category} {name}"
    return not any(token in text for token in excluded)


def build_candidates(products: list[Product], preference: str) -> tuple[list[ProductCandidate], list[str]]:
    warnings: list[str] = []
    candidates: list[ProductCandidate] = []
    excluded_count = 0

    for product in products:
        if not product_allowed(product, preference):
            excluded_count += 1
            continue

        cost_100g = cost_per_100g(product)
        if cost_100g <= 0:
            continue

        calories = int(round(as_float(product.calories_per_100g) * UNIT_G / 100 * SCALE))
        protein = int(round(as_float(product.protein_per_100g) * UNIT_G / 100 * SCALE))
        carbs = int(round(as_float(product.carbs_per_100g) * UNIT_G / 100 * SCALE))
        fat = int(round(as_float(product.fat_per_100g) * UNIT_G / 100 * SCALE))
        cost = int(round(cost_100g * UNIT_G / 100 * SCALE))

        if calories <= 0 and protein <= 0:
            continue

        candidates.append(
            ProductCandidate(
                product=product,
                calories=calories,
                protein=protein,
                carbs=carbs,
                fat=fat,
                cost=max(cost, 1),
                max_units=8,
            )
        )

    if excluded_count:
        warnings.append(f"Excluded {excluded_count} products because of the dietary preference filter.")
    if len(candidates) < 3:
        warnings.append("Only a small number of priced products are available; plan variety may be limited.")

    return candidates, warnings


def solve_plan(
    candidates: list[ProductCandidate],
    calorie_target: int,
    protein_target: float,
    budget_eur: float,
    max_items: int,
    relax_level: int,
):
    model = cp_model.CpModel()
    quantities = [model.NewIntVar(0, c.max_units, f"qty_{i}") for i, c in enumerate(candidates)]
    selected = [model.NewBoolVar(f"selected_{i}") for i in range(len(candidates))]

    for quantity, is_selected, candidate in zip(quantities, selected, candidates):
        model.Add(quantity <= candidate.max_units * is_selected)
        model.Add(quantity >= is_selected)

    total_calories = sum(quantity * candidate.calories for quantity, candidate in zip(quantities, candidates))
    total_protein = sum(quantity * candidate.protein for quantity, candidate in zip(quantities, candidates))
    total_cost = sum(quantity * candidate.cost for quantity, candidate in zip(quantities, candidates))

    target_calories = calorie_target * SCALE
    target_protein = int(round(protein_target * SCALE))
    target_budget = int(round(budget_eur * SCALE))

    if relax_level == 0:
        model.Add(total_calories >= int(target_calories * 0.85))
        model.Add(total_calories <= int(target_calories * 1.15))
        model.Add(total_protein >= target_protein)
        model.Add(total_cost <= target_budget)
    elif relax_level == 1:
        model.Add(total_calories >= int(target_calories * 0.70))
        model.Add(total_calories <= int(target_calories * 1.30))
        model.Add(total_protein >= int(target_protein * 0.80))
        model.Add(total_cost <= int(target_budget * 1.20))
    else:
        model.Add(total_calories >= int(target_calories * 0.50))
        model.Add(total_protein >= int(target_protein * 0.55))

    model.Add(sum(selected) <= min(max_items, len(candidates)))
    model.Add(sum(selected) >= min(3, len(candidates)))

    calorie_deviation = model.NewIntVar(0, target_calories * 2, "calorie_deviation")
    protein_shortfall = model.NewIntVar(0, target_protein, "protein_shortfall")
    budget_overrun = model.NewIntVar(0, max(target_budget * 3, 1), "budget_overrun")

    model.AddAbsEquality(calorie_deviation, total_calories - target_calories)
    model.Add(protein_shortfall >= target_protein - total_protein)
    model.Add(protein_shortfall >= 0)
    model.Add(budget_overrun >= total_cost - target_budget)
    model.Add(budget_overrun >= 0)

    model.Minimize(total_cost * 4 + calorie_deviation + protein_shortfall * 8 + budget_overrun * 12)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 8
    solver.parameters.num_search_workers = 8
    status = solver.Solve(model)

    if status not in {cp_model.OPTIMAL, cp_model.FEASIBLE}:
        return None

    quantities_result = [solver.Value(quantity) for quantity in quantities]
    return {
        "status": "optimal" if status == cp_model.OPTIMAL else "feasible",
        "quantities": quantities_result,
        "relax_level": relax_level,
    }


def item_from_candidate(candidate: ProductCandidate, units: int) -> OptimizedPlanItem:
    quantity_g = units * UNIT_G
    ratio = quantity_g / 100
    product = candidate.product
    return OptimizedPlanItem(
        product_id=product.id,
        name=product.name,
        brand=product.brand,
        category=product.category,
        quantity_g=round(quantity_g, 1),
        calories=round(as_float(product.calories_per_100g) * ratio, 2),
        protein=round(as_float(product.protein_per_100g) * ratio, 2),
        carbs=round(as_float(product.carbs_per_100g) * ratio, 2),
        fat=round(as_float(product.fat_per_100g) * ratio, 2),
        cost_eur=round(cost_per_100g(product) * ratio, 2),
        protein_efficiency_score=protein_efficiency(product),
    )


def totals_for_items(items: list[OptimizedPlanItem]) -> OptimizedPlanTotals:
    return OptimizedPlanTotals(
        calories=round(sum(item.calories for item in items), 2),
        protein=round(sum(item.protein for item in items), 2),
        carbs=round(sum(item.carbs for item in items), 2),
        fat=round(sum(item.fat for item in items), 2),
        cost_eur=round(sum(item.cost_eur for item in items), 2),
    )


def split_meals(items: list[OptimizedPlanItem], meals_per_day: int) -> list[OptimizedMeal]:
    buckets: list[list[OptimizedPlanItem]] = [[] for _ in range(meals_per_day)]
    sorted_items = sorted(items, key=lambda item: item.calories, reverse=True)

    for index, item in enumerate(sorted_items):
        buckets[index % meals_per_day].append(item)

    meals: list[OptimizedMeal] = []
    for index, bucket in enumerate(buckets):
        totals = totals_for_items(bucket)
        meals.append(
            OptimizedMeal(
                meal_type=MEAL_TYPES[index],
                items=bucket,
                total_calories=totals.calories,
                total_protein=totals.protein,
                total_carbs=totals.carbs,
                total_fat=totals.fat,
                total_cost_eur=totals.cost_eur,
            )
        )
    return meals


def fallback_plan(candidates: list[ProductCandidate], max_items: int) -> tuple[str, list[int]]:
    ranked = sorted(
        enumerate(candidates),
        key=lambda item: protein_efficiency(item[1].product),
        reverse=True,
    )
    quantities = [0 for _ in candidates]
    for index, _candidate in ranked[: min(max_items, len(ranked))]:
        quantities[index] = 2
    return "fallback", quantities


def optimize_meal_plan(db: Session, request: OptimizationRequest) -> OptimizationResponse:
    user = db.query(User).filter(User.id == request.user_id).first()
    if not user:
        raise ValueError("User not found")

    calorie_target = request.calorie_target or user.calorie_goal or 2000
    protein_target = request.protein_target if request.protein_target is not None else as_float(user.protein_goal)
    budget_eur = request.budget_eur if request.budget_eur is not None else round(as_float(user.budget_weekly) / 7, 2)
    dietary_preference = request.dietary_preference or user.dietary_preference or "none"

    products = db.query(Product).filter(
        Product.user_id == user.id, Product.estimated_price_eur.isnot(None)
    ).all()
    candidates, warnings = build_candidates(products, dietary_preference)
    if not candidates:
        raise ValueError("No priced products available for optimisation")

    solution = None
    for relax_level in range(3):
        solution = solve_plan(
            candidates,
            calorie_target,
            protein_target,
            budget_eur,
            request.max_items,
            relax_level,
        )
        if solution:
            break

    if not solution:
        status, quantities = fallback_plan(candidates, request.max_items)
        solution = {"status": status, "quantities": quantities, "relax_level": 3}
        warnings.append("No feasible constraint solution was found, so the plan uses a best-effort efficiency fallback.")
    elif solution["relax_level"] == 1:
        warnings.append("Targets were relaxed slightly to find a feasible plan.")
    elif solution["relax_level"] == 2:
        warnings.append("Targets were relaxed significantly; add more priced products for better optimisation.")

    items = [
        item_from_candidate(candidate, units)
        for candidate, units in zip(candidates, solution["quantities"])
        if units > 0
    ]
    items.sort(key=lambda item: item.protein_efficiency_score, reverse=True)
    totals = totals_for_items(items)
    meals = split_meals(items, request.meals_per_day)
    shopping_list = [
        ShoppingListItem(
            product_id=item.product_id,
            name=item.name,
            quantity_g=item.quantity_g,
            estimated_cost_eur=item.cost_eur,
        )
        for item in items
    ]

    if totals.cost_eur > budget_eur:
        warnings.append(f"Plan is EUR {totals.cost_eur - budget_eur:.2f} above the requested budget.")
    if totals.protein < protein_target:
        warnings.append(f"Plan is {protein_target - totals.protein:.1f}g below the requested protein target.")
    if totals.calories < calorie_target * 0.85:
        warnings.append("Plan is below the requested calorie range.")
    if totals.calories > calorie_target * 1.15:
        warnings.append("Plan is above the requested calorie range.")

    return OptimizationResponse(
        status=solution["status"],
        user_id=user.id,
        calorie_target=calorie_target,
        protein_target=protein_target,
        budget_eur=budget_eur,
        dietary_preference=dietary_preference,
        meals_per_day=request.meals_per_day,
        warnings=warnings,
        totals=totals,
        items=items,
        meals=meals,
        shopping_list=shopping_list,
    )
