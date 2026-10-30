# Phase 2: Recommendation Engine

Phase 2 adds rule-based intelligence on top of the Phase 1 product loop. The goal is to create useful, explainable recommendations before introducing heavier machine learning.

## What It Generates

The backend now generates and stores recommendations for:

- cheaper high-protein substitutions
- expensive low-protein products
- weekly budget pressure
- low protein progress for the current day
- best protein-per-euro product tips

## Backend Endpoints

### List Recommendations

```http
GET /recommendations/{user_id}
```

If the user has no stored recommendations, this endpoint generates them automatically.

Optional refresh:

```http
GET /recommendations/{user_id}?refresh=true
```

### Generate Recommendations

```http
POST /recommendations/generate/{user_id}
```

This deletes the previous generated recommendation set for the user and stores a fresh set.

## Response Shape

```json
{
  "user_id": 1,
  "count": 5,
  "recommendations": [
    {
      "id": 1,
      "user_id": 1,
      "type": "substitution",
      "message": "Swap Chicken Breast 1kg for Red Lentils 500g to save about EUR 5.41 per serving while keeping protein density strong.",
      "source_product_id": 2,
      "source_product_name": "Chicken Breast 1kg",
      "suggested_product_id": 6,
      "suggested_product_name": "Red Lentils 500g",
      "savings_eur": 5.41,
      "created_at": "2026-05-19T14:48:16.367910"
    }
  ]
}
```

## Frontend

The Lovable frontend now has an **AI recommendations** dashboard panel.

It supports:

- loading stored recommendations
- showing recommendation type badges
- displaying estimated savings
- showing source and suggested products
- refreshing recommendations from the dashboard

## Current Logic

The recommendation engine uses deterministic rules:

- Product costs are normalised to cost per 100g.
- Protein efficiency is calculated as protein per euro.
- Substitutions must be meaningfully cheaper and preserve most of the source product's protein density.
- Budget alerts compare the current week's meal cost against the user's weekly budget.
- Protein alerts compare today's logged protein against the user's protein goal.

This gives us explainable recommendations now, and leaves room for ML ranking later.
