from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, DateTime, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    calorie_goal = Column(Integer, default=2000)
    protein_goal = Column(Integer, default=150)
    budget_weekly = Column(Numeric(6, 2), default=50.00)
    dietary_preference = Column(String(50), default="none")
    password_hash = Column(String(255), nullable=True)  # null: no password set, can't log in
    created_at = Column(DateTime, server_default=func.now())
    meals = relationship("Meal", back_populates="user")
    spending = relationship("SpendingHistory", back_populates="user")
    recommendations = relationship("Recommendation", back_populates="user")

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    barcode = Column(String(50), unique=True, nullable=True)
    name = Column(String(200), nullable=False)
    brand = Column(String(100))
    calories_per_100g = Column(Numeric(6, 2))
    protein_per_100g = Column(Numeric(6, 2))
    carbs_per_100g = Column(Numeric(6, 2))
    fat_per_100g = Column(Numeric(6, 2))
    serving_size_g = Column(Numeric(6, 2))
    estimated_price_eur = Column(Numeric(6, 2))
    category = Column(String(100))
    created_at = Column(DateTime, server_default=func.now())

class Meal(Base):
    __tablename__ = "meals"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    name = Column(String(200), nullable=False)
    meal_type = Column(String(50))
    logged_at = Column(DateTime, server_default=func.now())
    total_calories = Column(Numeric(7, 2))
    total_protein = Column(Numeric(6, 2))
    total_carbs = Column(Numeric(6, 2))
    total_fat = Column(Numeric(6, 2))
    total_cost_eur = Column(Numeric(6, 2))
    user = relationship("User", back_populates="meals")
    food_logs = relationship("FoodLog", back_populates="meal")

class FoodLog(Base):
    __tablename__ = "food_logs"
    id = Column(Integer, primary_key=True, index=True)
    meal_id = Column(Integer, ForeignKey("meals.id", ondelete="CASCADE"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity_g = Column(Numeric(6, 2), nullable=False)
    calories = Column(Numeric(7, 2))
    protein = Column(Numeric(6, 2))
    carbs = Column(Numeric(6, 2))
    fat = Column(Numeric(6, 2))
    cost_eur = Column(Numeric(6, 2))
    meal = relationship("Meal", back_populates="food_logs")
    product = relationship("Product")

class SpendingHistory(Base):
    __tablename__ = "spending_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    date = Column(Date, nullable=False)
    total_spent_eur = Column(Numeric(6, 2))
    total_calories = Column(Integer)
    total_protein = Column(Numeric(6, 2))
    meal_count = Column(Integer)
    user = relationship("User", back_populates="spending")

class Recommendation(Base):
    __tablename__ = "recommendations"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    type = Column(String(100))
    message = Column(String)
    source_product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    suggested_product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    savings_eur = Column(Numeric(6, 2))
    created_at = Column(DateTime, server_default=func.now())
    user = relationship("User", back_populates="recommendations")

class AuthSession(Base):
    """One login. Only a SHA-256 of the token is stored, so a copy of the database can't be used to log in."""
    __tablename__ = "auth_sessions"
    token_hash = Column(String(64), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)


def ensure_schema(engine) -> None:
    """Create missing tables, and add columns that newer code expects to tables created before them."""
    from sqlalchemy import inspect, text

    Base.metadata.create_all(bind=engine)
    if "password_hash" not in {c["name"] for c in inspect(engine).get_columns("users")}:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)"))
