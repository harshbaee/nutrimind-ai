from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, DateTime, Date, UniqueConstraint
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
    """A food in one account's pantry, with that account's price and pack size."""
    __tablename__ = "products"
    __table_args__ = (UniqueConstraint("user_id", "barcode", name="uq_products_user_barcode"),)
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    barcode = Column(String(50), nullable=True)
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
    product_columns = [c["name"] for c in inspect(engine).get_columns("products")]
    if "user_id" not in product_columns:
        with engine.begin() as conn:
            split_shared_pantry(conn, engine.dialect.name, product_columns)


def split_shared_pantry(conn, dialect: str, product_columns: list[str]) -> None:
    """Pantries became per account. Every account was using the one shared pantry, so each gets its own copy,
    with its meals and recommendations pointed at that copy: nobody loses a food or a logged meal."""
    from sqlalchemy import text

    conn.execute(text("ALTER TABLE products ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE"))
    users = [row[0] for row in conn.execute(text("SELECT id FROM users ORDER BY id"))]
    if not users:
        return
    conn.execute(text("UPDATE products SET user_id = :u"), {"u": users[0]})
    if dialect != "postgresql":
        # shortcut: an existing SQLite file keeps its app-wide unique barcode (SQLite can't drop it without
        # rebuilding the table), so the oldest account keeps the foods and others start empty; fresh files are fine.
        return
    # The old rule allowed one product per barcode in the whole app; now it's one per account.
    conn.execute(text("ALTER TABLE products DROP CONSTRAINT IF EXISTS products_barcode_key"))
    conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_products_user_barcode ON products (user_id, barcode)"))
    copied = [c for c in product_columns if c != "id"]
    originals = [row[0] for row in conn.execute(text("SELECT id FROM products WHERE user_id = :u"), {"u": users[0]})]
    for user_id in users[1:]:
        for old_id in originals:
            new_id = conn.execute(
                text(f"INSERT INTO products ({', '.join(copied)}, user_id) SELECT {', '.join(copied)}, :u "
                     "FROM products WHERE id = :old RETURNING id"),
                {"u": user_id, "old": old_id},
            ).scalar()
            ids = {"u": user_id, "old": old_id, "new": new_id}
            conn.execute(text("UPDATE food_logs SET product_id = :new WHERE product_id = :old "
                              "AND meal_id IN (SELECT id FROM meals WHERE user_id = :u)"), ids)
            conn.execute(text("UPDATE recommendations SET source_product_id = :new "
                              "WHERE source_product_id = :old AND user_id = :u"), ids)
            conn.execute(text("UPDATE recommendations SET suggested_product_id = :new "
                              "WHERE suggested_product_id = :old AND user_id = :u"), ids)
