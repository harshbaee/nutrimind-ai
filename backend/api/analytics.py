import math
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database.database import get_db
from models.models import FoodLog, Product, SpendingHistory, Meal, User
from schemas import (
    BehaviourAnalyticsResponse,
    GamificationAnalyticsResponse,
    PredictiveAnalyticsResponse,
)
from services.behavioral import analyse_behaviour
from services.gamification import analyse_gamification
from services.predictive import analyse_predictive

router = APIRouter()

@router.get("/spending/{user_id}")
def spending_overview(user_id: int, db: Session = Depends(get_db)):
    records = db.query(SpendingHistory).filter(
        SpendingHistory.user_id == user_id
    ).order_by(SpendingHistory.date.desc()).limit(30).all()
    total_spent = sum(float(r.total_spent_eur or 0) for r in records)
    avg_daily = round(total_spent / len(records), 2) if records else 0
    return {
        "total_spent_eur": round(total_spent, 2),
        "avg_daily_spend_eur": avg_daily,
        "days_tracked": len(records),
        "history": [
            {"date": r.date, "spent": float(r.total_spent_eur or 0),
             "calories": r.total_calories, "protein": float(r.total_protein or 0),
             "meals": r.meal_count}
            for r in records
        ]
    }

@router.get("/shopping-list/{user_id}")
def shopping_list(user_id: int, db: Session = Depends(get_db)):
    """What to buy for a week like the last one: every food logged in the past 7 days, rounded up to whole packs."""
    if not db.query(User).filter(User.id == user_id).first():
        raise HTTPException(status_code=404, detail="User not found")
    since = datetime.combine(date.today() - timedelta(days=6), time.min)
    rows = (
        db.query(Product, func.sum(FoodLog.quantity_g))
        .join(FoodLog, FoodLog.product_id == Product.id)
        .join(Meal, Meal.id == FoodLog.meal_id)
        .filter(Meal.user_id == user_id, Meal.logged_at >= since)
        .group_by(Product.id)
        .all()
    )
    items = []
    for product, grams in rows:
        grams = float(grams or 0)
        pack = float(product.serving_size_g or 0)  # the amount the price buys
        packs = math.ceil(round(grams / pack, 6)) if pack else None
        price = product.estimated_price_eur
        cost = round(packs * float(price), 2) if packs and price is not None else None
        items.append({
            "product_id": product.id,
            "name": product.name,
            "grams": round(grams),
            "pack_size_g": pack or None,
            "packs": packs,
            "cost_eur": cost,
        })
    items.sort(key=lambda i: (i["cost_eur"] is None, -(i["cost_eur"] or 0)))
    return {
        "user_id": user_id,
        "items": items,
        "total_eur": round(sum(i["cost_eur"] or 0 for i in items), 2),
        "unpriced": sum(1 for i in items if i["cost_eur"] is None),
    }


@router.get("/meal-types/{user_id}")
def meal_type_breakdown(user_id: int, db: Session = Depends(get_db)):
    results = db.query(
        Meal.meal_type,
        func.count(Meal.id).label("count"),
        func.sum(Meal.total_cost_eur).label("total_cost"),
        func.avg(Meal.total_calories).label("avg_calories"),
        func.sum(Meal.total_calories).label("total_calories"),
        func.sum(Meal.total_protein).label("total_protein"),
        func.sum(Meal.total_carbs).label("total_carbs"),
        func.sum(Meal.total_fat).label("total_fat")
    ).filter(Meal.user_id == user_id).group_by(Meal.meal_type).all()
    return [
        {"meal_type": r.meal_type, "count": r.count,
         "total_cost_eur": round(float(r.total_cost or 0), 2),
         "avg_calories": round(float(r.avg_calories or 0), 2),
         "total_calories": round(float(r.total_calories or 0), 2),
         "total_protein": round(float(r.total_protein or 0), 2),
         "total_carbs": round(float(r.total_carbs or 0), 2),
         "total_fat": round(float(r.total_fat or 0), 2)}
        for r in results
    ]

@router.get("/weekly-summary/{user_id}")
def weekly_summary(user_id: int, db: Session = Depends(get_db)):
    from datetime import date, datetime, time, timedelta
    today = date.today()
    week_ago = today - timedelta(days=6)  # today + 6 previous days = 7 days, matching the weekly budget
    week_start = datetime.combine(week_ago, time.min)
    user = db.query(User).filter(User.id == user_id).first()
    meals = db.query(Meal).filter(
        Meal.user_id == user_id,
        Meal.logged_at >= week_start
    ).all()
    tracked_days = {meal.logged_at.date() for meal in meals if meal.logged_at}
    total_spent = sum(float(meal.total_cost_eur or 0) for meal in meals)
    total_calories = sum(float(meal.total_calories or 0) for meal in meals)
    total_protein = sum(float(meal.total_protein or 0) for meal in meals)
    total_carbs = sum(float(meal.total_carbs or 0) for meal in meals)
    total_fat = sum(float(meal.total_fat or 0) for meal in meals)
    budget = float(user.budget_weekly or 0) if user else 0
    return {
        "week_start": week_ago,
        "week_end": today,
        "total_spent_eur": round(total_spent, 2),
        "weekly_budget_eur": budget,
        "budget_remaining_eur": round(budget - total_spent, 2) if budget else None,
        "total_calories": round(total_calories, 2),
        "total_protein": round(total_protein, 2),
        "total_carbs": round(total_carbs, 2),
        "total_fat": round(total_fat, 2),
        "days_logged": len(tracked_days),
        "meal_count": len(meals),
        "avg_meal_cost_eur": round(total_spent / len(meals), 2) if meals else 0
    }


@router.get("/behaviour/{user_id}", response_model=BehaviourAnalyticsResponse)
def behavioural_analytics(
    user_id: int,
    days: int = Query(default=30, ge=7, le=90),
    db: Session = Depends(get_db),
):
    try:
        return analyse_behaviour(db, user_id, days)
    except ValueError as exc:
        if str(exc) == "User not found":
            raise HTTPException(status_code=404, detail="User not found")
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/predictive/{user_id}", response_model=PredictiveAnalyticsResponse)
def predictive_analytics(
    user_id: int,
    days: int = Query(default=30, ge=7, le=90),
    horizon: int = Query(default=7, ge=1, le=30),
    db: Session = Depends(get_db),
):
    try:
        return analyse_predictive(db, user_id, days, horizon)
    except ValueError as exc:
        if str(exc) == "User not found":
            raise HTTPException(status_code=404, detail="User not found")
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/gamification/{user_id}", response_model=GamificationAnalyticsResponse)
def gamification_analytics(
    user_id: int,
    days: int = Query(default=30, ge=7, le=90),
    db: Session = Depends(get_db),
):
    try:
        return analyse_gamification(db, user_id, days)
    except ValueError as exc:
        if str(exc) == "User not found":
            raise HTTPException(status_code=404, detail="User not found")
        raise HTTPException(status_code=400, detail=str(exc))
