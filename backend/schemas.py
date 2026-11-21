from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class UserBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=150)
    calorie_goal: int = Field(default=2000, gt=0)
    protein_goal: int = Field(default=150, ge=0)
    budget_weekly: float = Field(default=50.0, ge=0)
    dietary_preference: str = Field(default="none", max_length=50)


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    email: Optional[str] = Field(default=None, min_length=3, max_length=150)
    calorie_goal: Optional[int] = Field(default=None, gt=0)
    protein_goal: Optional[int] = Field(default=None, ge=0)
    budget_weekly: Optional[float] = Field(default=None, ge=0)
    dietary_preference: Optional[str] = Field(default=None, max_length=50)


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


def normalise_email(value: str) -> str:
    return value.strip().lower()


class SignUpRequest(UserBase):
    password: str = Field(min_length=8, max_length=128)
    _email = field_validator("email")(normalise_email)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=150)
    password: str = Field(min_length=1, max_length=128)
    _email = field_validator("email")(normalise_email)


class MealPhoto(BaseModel):
    # A browser data URL; ~6 MB of base64 is a 4.5 MB photo, far more than the 1024 px JPEG the app sends.
    image: str = Field(max_length=6_000_000, pattern=r"^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$")


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


class ProductBase(BaseModel):
    barcode: Optional[str] = Field(default=None, max_length=50)
    name: str = Field(min_length=1, max_length=200)
    brand: Optional[str] = Field(default=None, max_length=100)
    calories_per_100g: Optional[float] = Field(default=None, ge=0)
    protein_per_100g: Optional[float] = Field(default=None, ge=0)
    carbs_per_100g: Optional[float] = Field(default=None, ge=0)
    fat_per_100g: Optional[float] = Field(default=None, ge=0)
    serving_size_g: Optional[float] = Field(default=None, gt=0, lt=10000)  # column is Numeric(6,2)
    estimated_price_eur: Optional[float] = Field(default=None, ge=0)
    category: Optional[str] = Field(default=None, max_length=100)


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    barcode: Optional[str] = Field(default=None, max_length=50)
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    brand: Optional[str] = Field(default=None, max_length=100)
    calories_per_100g: Optional[float] = Field(default=None, ge=0)
    protein_per_100g: Optional[float] = Field(default=None, ge=0)
    carbs_per_100g: Optional[float] = Field(default=None, ge=0)
    fat_per_100g: Optional[float] = Field(default=None, ge=0)
    serving_size_g: Optional[float] = Field(default=None, gt=0, lt=10000)  # column is Numeric(6,2)
    estimated_price_eur: Optional[float] = Field(default=None, ge=0)
    category: Optional[str] = Field(default=None, max_length=100)


class ProductPriceUpdate(BaseModel):
    estimated_price_eur: float = Field(ge=0)
    serving_size_g: Optional[float] = Field(default=None, gt=0, lt=10000)  # column is Numeric(6,2)


class ProductResponse(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class FoodLogItemCreate(BaseModel):
    product_id: int
    quantity_g: float = Field(gt=0, le=5000)


class MealCreate(BaseModel):
    user_id: int
    name: str = Field(min_length=1, max_length=200)
    meal_type: str = Field(max_length=50)
    items: List[FoodLogItemCreate] = Field(min_length=1)


class MealUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    meal_type: Optional[str] = Field(default=None, max_length=50)
    items: Optional[List[FoodLogItemCreate]] = Field(default=None, min_length=1)


class FoodLogItemResponse(BaseModel):
    product_id: int
    product_name: Optional[str] = None
    quantity_g: float
    calories: float
    protein: float
    carbs: float
    fat: float
    cost_eur: float


class MealSummary(BaseModel):
    id: int
    name: str
    meal_type: Optional[str]
    logged_at: datetime
    total_calories: float
    total_protein: float
    total_carbs: float
    total_fat: float
    total_cost_eur: float


class MealDetail(BaseModel):
    meal: MealSummary
    items: List[FoodLogItemResponse]


class DailySummary(BaseModel):
    date: date
    total_calories: float
    total_protein: float
    total_carbs: float
    total_fat: float
    total_spent_eur: float
    meal_count: int
    calorie_goal: Optional[int] = None
    protein_goal: Optional[int] = None
    budget_weekly: Optional[float] = None


class RecommendationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    type: str
    message: str
    source_product_id: Optional[int] = None
    source_product_name: Optional[str] = None
    suggested_product_id: Optional[int] = None
    suggested_product_name: Optional[str] = None
    savings_eur: Optional[float] = None
    created_at: datetime


class RecommendationListResponse(BaseModel):
    user_id: int
    count: int
    recommendations: List[RecommendationResponse]


class OptimizationRequest(BaseModel):
    user_id: int
    calorie_target: Optional[int] = Field(default=None, gt=0)
    protein_target: Optional[float] = Field(default=None, ge=0)
    budget_eur: Optional[float] = Field(default=None, ge=0)
    dietary_preference: Optional[str] = Field(default=None, max_length=50)
    meals_per_day: int = Field(default=3, ge=1, le=5)
    max_items: int = Field(default=8, ge=1, le=12)


class OptimizedPlanItem(BaseModel):
    product_id: int
    name: str
    brand: Optional[str] = None
    category: Optional[str] = None
    quantity_g: float
    calories: float
    protein: float
    carbs: float
    fat: float
    cost_eur: float
    protein_efficiency_score: float


class OptimizedMeal(BaseModel):
    meal_type: str
    items: List[OptimizedPlanItem]
    total_calories: float
    total_protein: float
    total_carbs: float
    total_fat: float
    total_cost_eur: float


class ShoppingListItem(BaseModel):
    product_id: int
    name: str
    quantity_g: float
    estimated_cost_eur: float


class OptimizedPlanTotals(BaseModel):
    calories: float
    protein: float
    carbs: float
    fat: float
    cost_eur: float


class OptimizationResponse(BaseModel):
    status: str
    user_id: int
    calorie_target: int
    protein_target: float
    budget_eur: float
    dietary_preference: str
    meals_per_day: int
    warnings: List[str]
    totals: OptimizedPlanTotals
    items: List[OptimizedPlanItem]
    meals: List[OptimizedMeal]
    shopping_list: List[ShoppingListItem]


class BehaviourDay(BaseModel):
    date: date
    calories: float
    protein: float
    carbs: float
    fat: float
    cost_eur: float
    meal_count: int
    late_meal_count: int
    calorie_adherence_score: float
    protein_adherence_score: float
    budget_adherence_score: float
    flags: List[str]


class BehaviourInsight(BaseModel):
    type: str
    severity: str
    message: str


class BehaviourAnalyticsResponse(BaseModel):
    user_id: int
    period_start: date
    period_end: date
    days_considered: int
    days_logged: int
    meal_count: int
    meal_consistency_score: float
    calorie_adherence_score: float
    protein_adherence_score: float
    budget_adherence_score: float
    overall_adherence_score: float
    late_night_meal_count: int
    calorie_spike_days: int
    overspending_days: int
    low_protein_days: int
    avg_calories_logged_day: float
    avg_protein_logged_day: float
    avg_cost_logged_day: float
    daily_budget_eur: float
    insights: List[BehaviourInsight]
    daily: List[BehaviourDay]


class PredictiveForecastPoint(BaseModel):
    date: date
    calories: float
    protein: float
    cost_eur: float


class PredictiveAnomaly(BaseModel):
    date: date
    metric: str
    value: float
    expected_value: float
    severity: str
    message: str


class PredictiveInsight(BaseModel):
    type: str
    severity: str
    message: str


class PredictiveAnalyticsResponse(BaseModel):
    user_id: int
    period_start: date
    period_end: date
    horizon_days: int
    model_type: str
    daily: List[PredictiveForecastPoint]
    forecast: List[PredictiveForecastPoint]
    anomalies: List[PredictiveAnomaly]
    insights: List[PredictiveInsight]
    predicted_weekly_cost_eur: float
    predicted_weekly_protein: float
    predicted_avg_daily_calories: float
    budget_risk: bool
    protein_goal_risk: bool
    calorie_goal_risk: bool


class GamificationDay(BaseModel):
    date: date
    score: float
    meal_count: int
    budget_met: bool
    protein_met: bool
    calorie_met: bool


class GamificationBadge(BaseModel):
    id: str
    title: str
    description: str
    category: str
    level: str
    earned: bool
    progress: float
    target: float


class GamificationChallenge(BaseModel):
    id: str
    title: str
    description: str
    progress: float
    target: float
    unit: str
    reward_points: int
    expires_on: date


class GamificationInsight(BaseModel):
    type: str
    severity: str
    message: str


class GamificationAnalyticsResponse(BaseModel):
    user_id: int
    period_start: date
    period_end: date
    score: int
    level: int
    next_level_score: int
    logged_days: int
    meal_count: int
    current_logging_streak: int
    best_logging_streak: int
    budget_streak_days: int
    protein_target_days: int
    calorie_target_days: int
    badges: List[GamificationBadge]
    challenges: List[GamificationChallenge]
    insights: List[GamificationInsight]
    daily: List[GamificationDay]


class CoachMetricCard(BaseModel):
    label: str
    value: str
    detail: str
    status: str


class CoachAction(BaseModel):
    title: str
    rationale: str
    impact: str
    category: str
    priority: int = Field(ge=1, le=5)


class CoachRiskFlag(BaseModel):
    type: str
    severity: str
    message: str


class CoachBriefingResponse(BaseModel):
    user_id: int
    generated_at: datetime
    focus_area: str
    headline: str
    readiness_score: int = Field(ge=0, le=100)
    summary_cards: List[CoachMetricCard]
    action_plan: List[CoachAction]
    risk_flags: List[CoachRiskFlag]
    talking_points: List[str]
    data_quality_notes: List[str]


class CoachQuestionRequest(BaseModel):
    user_id: int
    question: str = Field(min_length=2, max_length=500)


class CoachAnswerResponse(BaseModel):
    user_id: int
    question: str
    answer: str
    suggested_actions: List[CoachAction]
    sources: List[str]
