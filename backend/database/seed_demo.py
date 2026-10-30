from datetime import datetime, timedelta
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.meals import apply_totals, build_food_logs, sync_spending_history
from database.database import SessionLocal, engine
from models.models import Base, Meal, Product, User
from schemas import FoodLogItemCreate


DEMO_USER = {
    "name": "Demo Athlete",
    "email": "demo@nutrimind.ai",
    "calorie_goal": 2200,
    "protein_goal": 160,
    "budget_weekly": 55.0,
    "dietary_preference": "high-protein",
}

DEMO_PRODUCTS = [
    {
        "barcode": "DEMO-SKYR-500",
        "name": "Plain Skyr 500g",
        "brand": "NutriMarket",
        "calories_per_100g": 62,
        "protein_per_100g": 11,
        "carbs_per_100g": 4,
        "fat_per_100g": 0.2,
        "serving_size_g": 500,
        "estimated_price_eur": 1.89,
        "category": "Dairy",
    },
    {
        "barcode": "DEMO-CHICKEN-1000",
        "name": "Chicken Breast 1kg",
        "brand": "Fresh Basics",
        "calories_per_100g": 120,
        "protein_per_100g": 23,
        "carbs_per_100g": 0,
        "fat_per_100g": 2.6,
        "serving_size_g": 1000,
        "estimated_price_eur": 8.99,
        "category": "Meat",
    },
    {
        "barcode": "DEMO-OATS-1000",
        "name": "Rolled Oats 1kg",
        "brand": "Bulk Pantry",
        "calories_per_100g": 389,
        "protein_per_100g": 16.9,
        "carbs_per_100g": 66.3,
        "fat_per_100g": 6.9,
        "serving_size_g": 1000,
        "estimated_price_eur": 1.59,
        "category": "Grains",
    },
    {
        "barcode": "DEMO-RICE-1000",
        "name": "Basmati Rice 1kg",
        "brand": "Daily Value",
        "calories_per_100g": 356,
        "protein_per_100g": 7.1,
        "carbs_per_100g": 78,
        "fat_per_100g": 0.7,
        "serving_size_g": 1000,
        "estimated_price_eur": 2.19,
        "category": "Grains",
    },
    {
        "barcode": "DEMO-EGGS-12",
        "name": "Free Range Eggs x12",
        "brand": "Farm Select",
        "calories_per_100g": 143,
        "protein_per_100g": 12.6,
        "carbs_per_100g": 0.7,
        "fat_per_100g": 9.5,
        "serving_size_g": 720,
        "estimated_price_eur": 3.49,
        "category": "Eggs",
    },
    {
        "barcode": "DEMO-LENTILS-500",
        "name": "Red Lentils 500g",
        "brand": "Plant Power",
        "calories_per_100g": 352,
        "protein_per_100g": 24.6,
        "carbs_per_100g": 52.7,
        "fat_per_100g": 1.1,
        "serving_size_g": 500,
        "estimated_price_eur": 1.79,
        "category": "Legumes",
    },
]

DEMO_MEALS = [
    ("Skyr oat bowl", "breakfast", 0, [("DEMO-SKYR-500", 250), ("DEMO-OATS-1000", 60)]),
    ("Chicken rice prep", "lunch", 0, [("DEMO-CHICKEN-1000", 180), ("DEMO-RICE-1000", 90)]),
    ("Eggs and lentils", "dinner", 1, [("DEMO-EGGS-12", 160), ("DEMO-LENTILS-500", 80)]),
    ("High-protein breakfast", "breakfast", 2, [("DEMO-SKYR-500", 300), ("DEMO-OATS-1000", 50)]),
    ("Budget lentil bowl", "lunch", 3, [("DEMO-LENTILS-500", 120), ("DEMO-RICE-1000", 100)]),
]


def upsert_user(db):
    user = db.query(User).filter(User.email == DEMO_USER["email"]).first()
    if not user:
        user = User(**DEMO_USER)
        db.add(user)
        db.flush()
        return user

    for key, value in DEMO_USER.items():
        setattr(user, key, value)
    db.flush()
    return user


def upsert_products(db):
    products_by_barcode = {}
    for payload in DEMO_PRODUCTS:
        product = db.query(Product).filter(Product.barcode == payload["barcode"]).first()
        if not product:
            product = Product(**payload)
            db.add(product)
        else:
            for key, value in payload.items():
                setattr(product, key, value)
        db.flush()
        products_by_barcode[payload["barcode"]] = product
    return products_by_barcode


def seed_meals(db, user, products_by_barcode):
    existing = db.query(Meal).filter(Meal.user_id == user.id).first()
    if existing:
        return

    touched_dates = set()
    for index, (name, meal_type, days_ago, items) in enumerate(DEMO_MEALS):
        meal_items = [
            FoodLogItemCreate(product_id=products_by_barcode[barcode].id, quantity_g=quantity)
            for barcode, quantity in items
        ]
        totals, food_logs = build_food_logs(meal_items, db)
        meal = Meal(
            user_id=user.id,
            name=name,
            meal_type=meal_type,
            logged_at=datetime.now() - timedelta(days=days_ago, hours=index),
        )
        apply_totals(meal, totals)
        db.add(meal)
        db.flush()

        for food_log in food_logs:
            food_log.meal_id = meal.id
            db.add(food_log)

        touched_dates.add(meal.logged_at.date())

    db.flush()
    for target_date in touched_dates:
        sync_spending_history(db, user.id, target_date)


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = upsert_user(db)
        products_by_barcode = upsert_products(db)
        seed_meals(db, user, products_by_barcode)
        db.commit()
        print(f"Seeded demo user {user.email} with {len(products_by_barcode)} products.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
