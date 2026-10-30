// Centralized API client for the NutriMind FastAPI backend.
// Override the base URL by setting VITE_API_BASE_URL in your environment.
export const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export type User = {
  id: number;
  name: string;
  email: string;
  calorie_goal: number;
  protein_goal: number;
  budget_weekly: number;
  dietary_preference: string;
  created_at: string;
};

export type DailySummary = {
  date: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  total_spent_eur: number;
  meal_count: number;
  calorie_goal: number;
  protein_goal: number;
  budget_weekly: number;
};

export type WeeklySummary = {
  week_start: string;
  week_end: string;
  total_spent_eur: number;
  weekly_budget_eur: number;
  budget_remaining_eur: number;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  days_logged: number;
  meal_count: number;
  avg_meal_cost_eur: number;
};

export type SpendingPoint = {
  date: string;
  spent: number;
  calories: number;
  protein: number;
  meals: number;
};

export type SpendingAnalytics = {
  total_spent_eur: number;
  avg_daily_spend_eur: number;
  days_tracked: number;
  history: SpendingPoint[];
};

export type MealTypeBreakdown = {
  meal_type: string;
  count: number;
  total_calories?: number;
  total_spent_eur?: number;
};

export type FoodSearchResult = {
  barcode: string;
  name: string;
  brand?: string | null;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  serving_size_g?: number | null;
  category?: string | null;
  nutriscore?: string | null;
  nova_group?: number | null;
};

export type SavedProduct = {
  id: number;
  barcode?: string | null;
  name: string;
  brand?: string | null;
  category?: string | null;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  serving_size_g?: number | null;
  estimated_price_eur?: number | null;
};

export type MealHistoryItem = {
  id: number;
  name: string;
  meal_type: string;
  logged_at: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  total_cost_eur: number;
};

export type RankingItem = {
  id: number;
  name: string;
  brand?: string | null;
  protein_efficiency_score: number;
  calories_per_euro: number;
  protein_per_100g: number;
  calories_per_100g: number;
  price_eur: number;
};

export type RecommendationItem = {
  id: number;
  user_id: number;
  type: "substitution" | "expensive_food" | "budget_alert" | "protein_alert" | "efficiency_tip" | string;
  message: string;
  source_product_id?: number | null;
  source_product_name?: string | null;
  suggested_product_id?: number | null;
  suggested_product_name?: string | null;
  savings_eur?: number | null;
  created_at: string;
};

export type RecommendationResponse = {
  user_id: number;
  count: number;
  recommendations: RecommendationItem[];
};

export type SaveProductResponse = {
  message: string;
  id: number;
  product: SavedProduct;
};

export type OptimizationRequest = {
  user_id: number;
  calorie_target?: number;
  protein_target?: number;
  budget_eur?: number;
  dietary_preference?: string;
  meals_per_day?: number;
  max_items?: number;
};

export type OptimizedPlanItem = {
  product_id: number;
  name: string;
  brand?: string | null;
  category?: string | null;
  quantity_g: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  cost_eur: number;
  protein_efficiency_score: number;
};

export type OptimizedMeal = {
  meal_type: string;
  items: OptimizedPlanItem[];
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  total_cost_eur: number;
};

export type OptimizationResponse = {
  status: string;
  user_id: number;
  calorie_target: number;
  protein_target: number;
  budget_eur: number;
  dietary_preference: string;
  meals_per_day: number;
  warnings: string[];
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    cost_eur: number;
  };
  items: OptimizedPlanItem[];
  meals: OptimizedMeal[];
  shopping_list: Array<{
    product_id: number;
    name: string;
    quantity_g: number;
    estimated_cost_eur: number;
  }>;
};

export type BehaviourDay = {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  cost_eur: number;
  meal_count: number;
  late_meal_count: number;
  calorie_adherence_score: number;
  protein_adherence_score: number;
  budget_adherence_score: number;
  flags: string[];
};

export type BehaviourInsight = {
  type: string;
  severity: "positive" | "warning" | "info" | string;
  message: string;
};

export type BehaviourAnalytics = {
  user_id: number;
  period_start: string;
  period_end: string;
  days_considered: number;
  days_logged: number;
  meal_count: number;
  meal_consistency_score: number;
  calorie_adherence_score: number;
  protein_adherence_score: number;
  budget_adherence_score: number;
  overall_adherence_score: number;
  late_night_meal_count: number;
  calorie_spike_days: number;
  overspending_days: number;
  low_protein_days: number;
  avg_calories_logged_day: number;
  avg_protein_logged_day: number;
  avg_cost_logged_day: number;
  daily_budget_eur: number;
  insights: BehaviourInsight[];
  daily: BehaviourDay[];
};

export type PredictiveForecastPoint = {
  date: string;
  calories: number;
  protein: number;
  cost_eur: number;
};

export type PredictiveAnomaly = {
  date: string;
  metric: "calories" | "protein" | "cost" | string;
  value: number;
  expected_value: number;
  severity: "positive" | "warning" | "info" | string;
  message: string;
};

export type PredictiveInsight = {
  type: string;
  severity: "positive" | "warning" | "info" | string;
  message: string;
};

export type PredictiveAnalytics = {
  user_id: number;
  period_start: string;
  period_end: string;
  horizon_days: number;
  model_type: string;
  daily: PredictiveForecastPoint[];
  forecast: PredictiveForecastPoint[];
  anomalies: PredictiveAnomaly[];
  insights: PredictiveInsight[];
  predicted_weekly_cost_eur: number;
  predicted_weekly_protein: number;
  predicted_avg_daily_calories: number;
  budget_risk: boolean;
  protein_goal_risk: boolean;
  calorie_goal_risk: boolean;
};

export type GamificationDay = {
  date: string;
  score: number;
  meal_count: number;
  budget_met: boolean;
  protein_met: boolean;
  calorie_met: boolean;
};

export type GamificationBadge = {
  id: string;
  title: string;
  description: string;
  category: string;
  level: "bronze" | "silver" | "gold" | string;
  earned: boolean;
  progress: number;
  target: number;
};

export type GamificationChallenge = {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  unit: string;
  reward_points: number;
  expires_on: string;
};

export type GamificationInsight = {
  type: string;
  severity: "positive" | "warning" | "info" | string;
  message: string;
};

export type GamificationAnalytics = {
  user_id: number;
  period_start: string;
  period_end: string;
  score: number;
  level: number;
  next_level_score: number;
  logged_days: number;
  meal_count: number;
  current_logging_streak: number;
  best_logging_streak: number;
  budget_streak_days: number;
  protein_target_days: number;
  calorie_target_days: number;
  badges: GamificationBadge[];
  challenges: GamificationChallenge[];
  insights: GamificationInsight[];
  daily: GamificationDay[];
};

export type CoachMetricCard = {
  label: string;
  value: string;
  detail: string;
  status: "positive" | "warning" | "info" | string;
};

export type CoachAction = {
  title: string;
  rationale: string;
  impact: string;
  category: string;
  priority: number;
};

export type CoachRiskFlag = {
  type: string;
  severity: "positive" | "warning" | "info" | string;
  message: string;
};

export type CoachBriefing = {
  user_id: number;
  generated_at: string;
  focus_area: string;
  headline: string;
  readiness_score: number;
  summary_cards: CoachMetricCard[];
  action_plan: CoachAction[];
  risk_flags: CoachRiskFlag[];
  talking_points: string[];
  data_quality_notes: string[];
};

export type CoachAnswer = {
  user_id: number;
  question: string;
  answer: string;
  suggested_actions: CoachAction[];
  sources: string[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ""}`,
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  listUsers: () => request<User[]>("/users/"),
  dailySummary: (userId: number) =>
    request<DailySummary>(`/nutrition/daily-summary/${userId}`),
  weeklySummary: (userId: number) =>
    request<WeeklySummary>(`/analytics/weekly-summary/${userId}`),
  spending: (userId: number) =>
    request<SpendingAnalytics>(`/analytics/spending/${userId}`),
  mealTypes: (userId: number) =>
    request<MealTypeBreakdown[] | { breakdown: MealTypeBreakdown[] }>(
      `/analytics/meal-types/${userId}`,
    ),
  searchFood: (query: string) =>
    request<{ query: string; count: number; results: FoodSearchResult[] }>(
      `/food/search?query=${encodeURIComponent(query)}`,
    ),
  saveProduct: (body: Omit<SavedProduct, "id">) =>
    request<SaveProductResponse>("/food/save", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  savedProducts: () => request<SavedProduct[]>("/food/saved"),
  updatePrice: (
    productId: number,
    body: { estimated_price_eur: number; serving_size_g?: number },
  ) =>
    request<SavedProduct>(`/food/${productId}/price`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  logMeal: (body: {
    user_id: number;
    name: string;
    meal_type: string;
    items: { product_id: number; quantity_g: number }[];
  }) =>
    request<MealHistoryItem>("/meals/log", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  mealHistory: (userId: number) =>
    request<MealHistoryItem[]>(`/meals/history/${userId}`),
  deleteMeal: (mealId: number) =>
    request<void>(`/meals/${mealId}`, { method: "DELETE" }),
  rankings: () =>
    request<{ rankings: RankingItem[] }>(`/nutrition/rankings`),
  recommendations: (userId: number, refresh = false) =>
    request<RecommendationResponse>(
      `/recommendations/${userId}${refresh ? "?refresh=true" : ""}`,
    ),
  generateRecommendations: (userId: number) =>
    request<RecommendationResponse>(`/recommendations/generate/${userId}`, {
      method: "POST",
    }),
  optimizeMealPlan: (body: OptimizationRequest) =>
    request<OptimizationResponse>("/optimization/meal-plan", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  behaviour: (userId: number, days = 30) =>
    request<BehaviourAnalytics>(`/analytics/behaviour/${userId}?days=${days}`),
  predictive: (userId: number, days = 30, horizon = 7) =>
    request<PredictiveAnalytics>(
      `/analytics/predictive/${userId}?days=${days}&horizon=${horizon}`,
    ),
  gamification: (userId: number, days = 30) =>
    request<GamificationAnalytics>(`/analytics/gamification/${userId}?days=${days}`),
  coachBriefing: (userId: number, days = 30) =>
    request<CoachBriefing>(`/coach/briefing/${userId}?days=${days}`),
  askCoach: (body: { user_id: number; question: string }, days = 30) =>
    request<CoachAnswer>(`/coach/ask?days=${days}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
