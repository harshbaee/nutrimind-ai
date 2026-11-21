from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database.database import get_db
from models.models import FoodLog, Meal, Product, SpendingHistory, User
from schemas import FoodLogItemCreate, FoodLogItemResponse, MealCreate, MealDetail, MealSummary, MealUpdate
from services.auth import require_self

router = APIRouter()


def as_float(value) -> float:
    return float(value or 0)


def meal_summary(meal: Meal) -> MealSummary:
    return MealSummary(
        id=meal.id,
        name=meal.name,
        meal_type=meal.meal_type,
        logged_at=meal.logged_at,
        total_calories=as_float(meal.total_calories),
        total_protein=as_float(meal.total_protein),
        total_carbs=as_float(meal.total_carbs),
        total_fat=as_float(meal.total_fat),
        total_cost_eur=as_float(meal.total_cost_eur),
    )


def food_log_response(log: FoodLog) -> FoodLogItemResponse:
    return FoodLogItemResponse(
        product_id=log.product_id,
        product_name=log.product.name if log.product else None,
        quantity_g=as_float(log.quantity_g),
        calories=as_float(log.calories),
        protein=as_float(log.protein),
        carbs=as_float(log.carbs),
        fat=as_float(log.fat),
        cost_eur=as_float(log.cost_eur),
    )


def meal_detail(meal: Meal, db: Session) -> MealDetail:
    logs = db.query(FoodLog).filter(FoodLog.meal_id == meal.id).all()
    return MealDetail(meal=meal_summary(meal), items=[food_log_response(log) for log in logs])


def build_food_logs(items: list[FoodLogItemCreate], db: Session):
    totals = {
        "calories": 0.0,
        "protein": 0.0,
        "carbs": 0.0,
        "fat": 0.0,
        "cost": 0.0,
    }
    entries: list[FoodLog] = []

    for item in items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")

        ratio = item.quantity_g / 100
        serving_size = as_float(product.serving_size_g) or 100
        price = as_float(product.estimated_price_eur)

        calories = as_float(product.calories_per_100g) * ratio
        protein = as_float(product.protein_per_100g) * ratio
        carbs = as_float(product.carbs_per_100g) * ratio
        fat = as_float(product.fat_per_100g) * ratio
        cost = price * (item.quantity_g / serving_size)

        totals["calories"] += calories
        totals["protein"] += protein
        totals["carbs"] += carbs
        totals["fat"] += fat
        totals["cost"] += cost

        entries.append(
            FoodLog(
                product_id=item.product_id,
                quantity_g=item.quantity_g,
                calories=calories,
                protein=protein,
                carbs=carbs,
                fat=fat,
                cost_eur=cost,
            )
        )

    return totals, entries


def apply_totals(meal: Meal, totals: dict[str, float]) -> None:
    meal.total_calories = totals["calories"]
    meal.total_protein = totals["protein"]
    meal.total_carbs = totals["carbs"]
    meal.total_fat = totals["fat"]
    meal.total_cost_eur = totals["cost"]


def sync_spending_history(db: Session, user_id: int, target_date: date) -> None:
    start = datetime.combine(target_date, time.min)
    end = start + timedelta(days=1)
    meals = db.query(Meal).filter(
        Meal.user_id == user_id,
        Meal.logged_at >= start,
        Meal.logged_at < end,
    ).all()

    spending = db.query(SpendingHistory).filter(
        SpendingHistory.user_id == user_id,
        SpendingHistory.date == target_date,
    ).first()

    if not meals:
        if spending:
            db.delete(spending)
            db.flush()
        return

    total_spent = sum(as_float(meal.total_cost_eur) for meal in meals)
    total_calories = sum(as_float(meal.total_calories) for meal in meals)
    total_protein = sum(as_float(meal.total_protein) for meal in meals)

    if not spending:
        spending = SpendingHistory(user_id=user_id, date=target_date)
        db.add(spending)

    spending.total_spent_eur = total_spent
    spending.total_calories = int(round(total_calories))
    spending.total_protein = total_protein
    spending.meal_count = len(meals)
    db.flush()


@router.post("/log", response_model=MealDetail, status_code=201)
def log_meal(meal_data: MealCreate, request: Request, db: Session = Depends(get_db)):
    require_self(request, meal_data.user_id)
    return create_meal(meal_data, db)


def create_meal(meal_data: MealCreate, db: Session) -> MealDetail:
    user = db.query(User).filter(User.id == meal_data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    totals, food_log_entries = build_food_logs(meal_data.items, db)
    meal = Meal(
        user_id=meal_data.user_id,
        name=meal_data.name,
        meal_type=meal_data.meal_type,
        logged_at=datetime.now(),
    )
    apply_totals(meal, totals)

    db.add(meal)
    db.flush()

    for entry in food_log_entries:
        entry.meal_id = meal.id
        db.add(entry)

    sync_spending_history(db, meal.user_id, meal.logged_at.date())
    db.commit()
    db.refresh(meal)
    return meal_detail(meal, db)


@router.get("/history/{user_id}", response_model=list[MealSummary])
def get_meal_history(user_id: int, db: Session = Depends(get_db)):
    meals = db.query(Meal).filter(Meal.user_id == user_id).order_by(Meal.logged_at.desc()).limit(30).all()
    return [meal_summary(meal) for meal in meals]


@router.put("/{meal_id}", response_model=MealDetail)
def update_meal(meal_id: int, meal_data: MealUpdate, db: Session = Depends(get_db)):
    meal = db.query(Meal).filter(Meal.id == meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")

    target_date = meal.logged_at.date()
    updates = meal_data.model_dump(exclude_unset=True)

    if "name" in updates:
        meal.name = meal_data.name
    if "meal_type" in updates:
        meal.meal_type = meal_data.meal_type

    if meal_data.items is not None:
        db.query(FoodLog).filter(FoodLog.meal_id == meal.id).delete(synchronize_session=False)
        totals, food_log_entries = build_food_logs(meal_data.items, db)
        apply_totals(meal, totals)
        db.flush()
        for entry in food_log_entries:
            entry.meal_id = meal.id
            db.add(entry)

    sync_spending_history(db, meal.user_id, target_date)
    db.commit()
    db.refresh(meal)
    return meal_detail(meal, db)


@router.delete("/{meal_id}")
def delete_meal(meal_id: int, db: Session = Depends(get_db)):
    meal = db.query(Meal).filter(Meal.id == meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")

    user_id = meal.user_id
    target_date = meal.logged_at.date()
    db.query(FoodLog).filter(FoodLog.meal_id == meal.id).delete(synchronize_session=False)
    db.delete(meal)
    db.flush()
    sync_spending_history(db, user_id, target_date)
    db.commit()
    return {"message": "Meal deleted", "meal_id": meal_id}


@router.post("/{meal_id}/repeat", response_model=MealDetail, status_code=201)
def repeat_meal(meal_id: int, db: Session = Depends(get_db)):
    """Log a past meal again now, with the same foods and amounts at today's prices."""
    meal = db.query(Meal).filter(Meal.id == meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    logs = db.query(FoodLog).filter(FoodLog.meal_id == meal.id).all()
    if not logs:
        raise HTTPException(status_code=400, detail="That meal has no foods to repeat")
    items = [FoodLogItemCreate(product_id=log.product_id, quantity_g=as_float(log.quantity_g)) for log in logs]
    return create_meal(
        MealCreate(user_id=meal.user_id, name=meal.name, meal_type=meal.meal_type or "snack", items=items), db
    )


@router.get("/{meal_id}", response_model=MealDetail)
def get_meal_detail(meal_id: int, db: Session = Depends(get_db)):
    meal = db.query(Meal).filter(Meal.id == meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    return meal_detail(meal, db)
