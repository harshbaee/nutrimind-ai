# Phase 3: Meal Plan Optimisation Engine

Phase 3 adds the platform's signature optimisation feature: a budget-aware meal plan generator that selects saved products to satisfy nutrition targets.

## What It Does

The optimiser uses saved products with estimated prices and nutrition values to generate:

- an optimised daily meal plan
- total calories, protein, carbs, fat, and cost
- meal-level splits
- a shopping list
- constraint warnings when targets need relaxing

## Backend Endpoint

```http
POST /optimization/meal-plan
```

## Request Shape

```json
{
  "user_id": 1,
  "calorie_target": 2200,
  "protein_target": 160,
  "budget_eur": 8,
  "dietary_preference": "high-protein",
  "meals_per_day": 3,
  "max_items": 8
}
```

If targets are omitted, the backend uses the selected user's profile:

- `calorie_goal`
- `protein_goal`
- `budget_weekly / 7`
- `dietary_preference`

## Response Shape

```json
{
  "status": "optimal",
  "user_id": 1,
  "calorie_target": 2200,
  "protein_target": 160,
  "budget_eur": 8,
  "dietary_preference": "high-protein",
  "meals_per_day": 3,
  "warnings": [],
  "totals": {
    "calories": 2201,
    "protein": 160.05,
    "carbs": 311.85,
    "fat": 26.75,
    "cost_eur": 3.31
  },
  "items": [],
  "meals": [],
  "shopping_list": []
}
```

## Optimisation Logic

The backend uses OR-Tools CP-SAT.

It models each saved product as a selectable quantity in 50g units. Nutrients and costs are scaled to integers so they can be used safely by the solver.

The solver tries:

1. strict targets
2. lightly relaxed targets
3. significantly relaxed targets
4. best-effort fallback if no feasible solver result exists

The objective balances:

- low cost
- calorie target fit
- protein target fit
- budget fit

## Dietary Filtering

The first version supports simple filters:

- `none`
- `high-protein`
- `vegetarian`
- `vegan`

Vegetarian and vegan modes exclude matching product categories/names before optimisation.

## Frontend

The Lovable dashboard now includes a **Meal plan optimiser** panel.

It allows the user to set:

- calorie target
- protein target
- daily budget
- dietary preference
- number of meals

It displays:

- optimiser status
- macro and cost totals
- warnings
- planned meals
- shopping list

## Local Verification

The local demo run produced:

- status: `optimal`
- calories: `2201`
- protein: `160.05g`
- cost: `EUR 3.31`

The UI was verified in the browser at:

```text
http://127.0.0.1:5173
```
