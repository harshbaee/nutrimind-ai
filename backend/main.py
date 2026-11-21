from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
try:
    from .api import analytics, auth, coach, food, meals, nutrition, optimization, recommendations, users
except ImportError:
    from api import analytics, auth, coach, food, meals, nutrition, optimization, recommendations, users
from database.database import engine
from models.models import ensure_schema
from services.auth import authorize

ensure_schema(engine)  # adds the login tables and column to databases created before them

app = FastAPI(title="NutriMind AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
# Everything else needs a login, and authorize() checks any user or meal in the path belongs to it.
logged_in = [Depends(authorize)]
app.include_router(users.router, prefix="/users", tags=["Users"], dependencies=logged_in)
app.include_router(food.router, prefix="/food", tags=["Food"], dependencies=logged_in)
app.include_router(meals.router, prefix="/meals", tags=["Meals"], dependencies=logged_in)
app.include_router(nutrition.router, prefix="/nutrition", tags=["Nutrition"], dependencies=logged_in)
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"], dependencies=logged_in)
app.include_router(recommendations.router, prefix="/recommendations", tags=["Recommendations"], dependencies=logged_in)
app.include_router(optimization.router, prefix="/optimization", tags=["Optimization"], dependencies=logged_in)
app.include_router(coach.router, prefix="/coach", tags=["Coach"], dependencies=logged_in)

@app.get("/")
def root():
    return {"message": "NutriMind AI is running"}
