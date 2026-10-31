from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from datetime import datetime, time, timedelta
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database.database import get_db
from models.models import Product, Meal, User
from schemas import DailySummary
from services.recommendations import cost_per_100g

router = APIRouter()

@router.get("/efficiency/{product_id}")
def product_efficiency(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    # Price is for the whole pack (serving_size_g), so scores use the cost of 100g.
    cost = cost_per_100g(product)
    price = float(product.estimated_price_eur or 0)
    protein = float(product.protein_per_100g or 0)
    calories = float(product.calories_per_100g or 0)
    pes = round(protein / cost, 2) if cost else 0
    cpe = round(calories / cost, 2) if cost else 0
    nutrition_score = round((protein * 4 + (calories - protein * 4) * 0.5) / cost, 2) if cost else 0
    return {
        "product_id": product_id,
        "name": product.name,
        "protein_efficiency_score": pes,
        "calories_per_euro": cpe,
        "nutrition_score": nutrition_score,
        "price_eur": price,
        "protein_per_100g": protein,
        "calories_per_100g": calories
    }

@router.get("/daily-summary/{user_id}", response_model=DailySummary)
def daily_summary(user_id: int, db: Session = Depends(get_db)):
    from datetime import date
    today = date.today()
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    start = datetime.combine(today, time.min)
    end = start + timedelta(days=1)
    meals = db.query(Meal).filter(
        Meal.user_id == user_id,
        Meal.logged_at >= start,
        Meal.logged_at < end,
    ).all()

    return {
        "date": today,
        "total_calories": round(sum(float(meal.total_calories or 0) for meal in meals), 2),
        "total_protein": round(sum(float(meal.total_protein or 0) for meal in meals), 2),
        "total_carbs": round(sum(float(meal.total_carbs or 0) for meal in meals), 2),
        "total_fat": round(sum(float(meal.total_fat or 0) for meal in meals), 2),
        "total_spent_eur": round(sum(float(meal.total_cost_eur or 0) for meal in meals), 2),
        "meal_count": len(meals),
        "calorie_goal": user.calorie_goal,
        "protein_goal": user.protein_goal,
        "budget_weekly": float(user.budget_weekly or 0),
    }

@router.get("/rankings")
def efficiency_rankings(db: Session = Depends(get_db)):
    products = db.query(Product).filter(Product.estimated_price_eur.isnot(None)).all()
    rankings = []
    for p in products:
        cost = cost_per_100g(p)
        protein = float(p.protein_per_100g or 0)
        calories = float(p.calories_per_100g or 0)
        if cost:
            rankings.append({
                "id": p.id, "name": p.name, "brand": p.brand,
                "protein_efficiency_score": round(protein / cost, 2),
                "calories_per_euro": round(calories / cost, 2),
                "protein_per_100g": protein,
                "calories_per_100g": calories,
                "price_eur": float(p.estimated_price_eur)
            })
    rankings.sort(key=lambda x: x["protein_efficiency_score"], reverse=True)
    return {"rankings": rankings[:20]}
