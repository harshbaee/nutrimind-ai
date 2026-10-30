# Lovable Frontend Brief

Use this brief as the first Lovable prompt for the NutriMind AI frontend.

## Build Prompt

Build the MVP frontend for **NutriMind AI**, an AI-powered nutrition, meal cost, and food optimisation dashboard.

This should be a real app dashboard as the first screen, not a marketing landing page.

Use Lovable's current default React/TanStack web stack with Tailwind styling. Use Recharts or the best available charting library for dashboard visualisations. Do not add Supabase, authentication, or a new backend yet. This frontend must connect to my existing FastAPI backend.

### Product Goal

NutriMind AI helps users track:

- calories and macros
- meal cost
- protein per euro
- weekly budget usage
- saved food products
- nutrition efficiency rankings
- recent meals

The product should feel like a polished SaaS analytics tool for nutrition and budget optimisation, not a calorie tracker clone.

### Design Direction

Create a quiet, premium dashboard UI:

- dense but readable layout
- top KPI cards
- charts for spending, protein, macros, and meal types
- saved products table/list
- food search panel
- meal logging panel
- protein efficiency ranking list
- recent meals list

Avoid a big landing-page hero. The dashboard should be immediately usable.

Use a balanced palette with white/light grey surfaces, dark text, green for nutrition/protein, warm orange/red for spending, and blue for goal progress. Keep cards compact with subtle borders and 8px radius or less.

### Backend Base URL

Create a single API client file, for example:

`src/lib/api.ts`

Use this configurable base URL:

```ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
```

Important: Lovable's cloud preview may not be able to call `localhost`. If preview cannot reach the backend, keep the UI wired correctly and make the base URL easy to replace with the deployed backend URL.

### Required Screens/Sections

Build one dashboard page with these sections:

1. User selector/profile area
   - load users from `GET /users/`
   - select the active user
   - show calorie goal, protein goal, weekly budget

2. KPI cards
   - today's calories vs calorie goal
   - today's protein vs protein goal
   - today's spend
   - weekly budget remaining

3. Charts
   - spending over time from `GET /analytics/spending/{user_id}`
   - protein over time from the same endpoint
   - macro breakdown from `GET /nutrition/daily-summary/{user_id}`
   - meal type breakdown from `GET /analytics/meal-types/{user_id}`

4. Food search
   - input for search query
   - call `GET /food/search?query={query}`
   - show product name, brand, calories, protein, carbs, fat
   - button to save product using `POST /food/save`

5. Saved products
   - call `GET /food/saved`
   - show name, brand, category, calories, protein, serving size, estimated price
   - allow editing price using `PATCH /food/{product_id}/price`

6. Meal logger
   - select saved products
   - enter quantity in grams
   - build a list of meal items
   - enter meal name and meal type
   - submit to `POST /meals/log`
   - refresh dashboard data after success

7. Protein efficiency rankings
   - call `GET /nutrition/rankings`
   - show top foods by protein efficiency score

8. Recent meals
   - call `GET /meals/history/{user_id}`
   - show calories, protein, carbs, fat, cost
   - allow deleting a meal with `DELETE /meals/{meal_id}`

### API Contract

#### Users

`GET /users/`

Returns:

```json
[
  {
    "id": 1,
    "name": "Demo Athlete",
    "email": "demo@nutrimind.ai",
    "calorie_goal": 2200,
    "protein_goal": 160,
    "budget_weekly": 55.0,
    "dietary_preference": "high-protein",
    "created_at": "2026-05-19T14:11:49.578356"
  }
]
```

#### Daily Summary

`GET /nutrition/daily-summary/{user_id}`

```json
{
  "date": "2026-05-19",
  "total_calories": 924.8,
  "total_protein": 85.43,
  "total_carbs": 119.98,
  "total_fat": 9.95,
  "total_spent_eur": 2.86,
  "meal_count": 2,
  "calorie_goal": 2200,
  "protein_goal": 160,
  "budget_weekly": 55.0
}
```

#### Weekly Summary

`GET /analytics/weekly-summary/{user_id}`

```json
{
  "week_start": "2026-05-12",
  "week_end": "2026-05-19",
  "total_spent_eur": 5.78,
  "weekly_budget_eur": 55.0,
  "budget_remaining_eur": 49.22,
  "total_calories": 2594.1,
  "total_protein": 203.34,
  "total_carbs": 349.65,
  "total_fat": 32.1,
  "days_logged": 4,
  "meal_count": 5,
  "avg_meal_cost_eur": 1.16
}
```

#### Spending

`GET /analytics/spending/{user_id}`

```json
{
  "total_spent_eur": 5.78,
  "avg_daily_spend_eur": 1.45,
  "days_tracked": 4,
  "history": [
    {
      "date": "2026-05-19",
      "spent": 2.86,
      "calories": 925,
      "protein": 85.43,
      "meals": 2
    }
  ]
}
```

#### Food Search

`GET /food/search?query=chicken`

```json
{
  "query": "chicken",
  "count": 10,
  "results": [
    {
      "barcode": "3242274030056",
      "name": "Salade Composee Manhattan Poulet Roti",
      "brand": "Sodebo",
      "calories_per_100g": 185.94,
      "protein_per_100g": 8.44,
      "carbs_per_100g": 17,
      "fat_per_100g": 8.75,
      "serving_size_g": 320,
      "category": "Meals",
      "nutriscore": "c",
      "nova_group": 4
    }
  ]
}
```

#### Save Product

`POST /food/save`

Request:

```json
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
  "category": "Dairy"
}
```

#### Saved Products

`GET /food/saved`

Returns an array of products.

#### Update Product Price

`PATCH /food/{product_id}/price`

Request:

```json
{
  "estimated_price_eur": 2.49,
  "serving_size_g": 500
}
```

#### Log Meal

`POST /meals/log`

Request:

```json
{
  "user_id": 1,
  "name": "Chicken rice prep",
  "meal_type": "lunch",
  "items": [
    {
      "product_id": 2,
      "quantity_g": 180
    },
    {
      "product_id": 4,
      "quantity_g": 90
    }
  ]
}
```

#### Meal History

`GET /meals/history/{user_id}`

Returns:

```json
[
  {
    "id": 1,
    "name": "Skyr oat bowl",
    "meal_type": "breakfast",
    "logged_at": "2026-05-19T16:11:49.620604",
    "total_calories": 388.4,
    "total_protein": 37.64,
    "total_carbs": 49.78,
    "total_fat": 4.64,
    "total_cost_eur": 1.04
  }
]
```

#### Delete Meal

`DELETE /meals/{meal_id}`

#### Rankings

`GET /nutrition/rankings`

```json
{
  "rankings": [
    {
      "id": 6,
      "name": "Red Lentils 500g",
      "brand": "Plant Power",
      "protein_efficiency_score": 13.74,
      "calories_per_euro": 196.65,
      "protein_per_100g": 24.6,
      "calories_per_100g": 352,
      "price_eur": 1.79
    }
  ]
}
```

### Interaction Requirements

- Show loading states for API calls.
- Show helpful error banners.
- Refresh dependent dashboard data after saving a product, editing price, logging a meal, or deleting a meal.
- Keep data fetching logic centralized.
- Do not hardcode demo data except as empty/loading fallbacks.
- Use responsive layouts for laptop and mobile.

### First Iteration Scope

Do not build:

- auth
- payments
- social features
- AI chat
- forecasting
- anomaly detection
- meal optimisation

Those come after the MVP loop is stable.
