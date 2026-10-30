from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
try:
    from .api import analytics, coach, food, meals, nutrition, optimization, recommendations, users
except ImportError:
    from api import analytics, coach, food, meals, nutrition, optimization, recommendations, users

app = FastAPI(title="NutriMind AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(food.router, prefix="/food", tags=["Food"])
app.include_router(meals.router, prefix="/meals", tags=["Meals"])
app.include_router(nutrition.router, prefix="/nutrition", tags=["Nutrition"])
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
app.include_router(recommendations.router, prefix="/recommendations", tags=["Recommendations"])
app.include_router(optimization.router, prefix="/optimization", tags=["Optimization"])
app.include_router(coach.router, prefix="/coach", tags=["Coach"])

@app.get("/")
def root():
    return {"message": "NutriMind AI is running"}
