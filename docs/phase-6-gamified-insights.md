# Phase 6 - Gamified Insights

Phase 6 adds an engagement layer on top of NutriMind AI's nutrition and cost analytics. It converts existing meal logs into streaks, badges, weekly challenges, and motivational insights without adding a new persistence table yet.

## Backend

- Added `backend/services/gamification.py`.
- Added `GET /analytics/gamification/{user_id}?days=30`.
- Added Pydantic response models for daily momentum, badges, challenges, insights, and score totals.

The service calculates:

- momentum score and level
- current and best logging streaks
- budget-friendly streaks
- protein and calorie target days
- earned and in-progress badges
- weekly challenges with reward points
- concise gamified insights

## Frontend

- Added `GamifiedInsightsPanel`.
- Added gamification API client types and query hook.
- Rendered the panel in the main dashboard after predictive analytics.

The dashboard now shows momentum KPI cards, a daily momentum chart, weekly challenges, badge progress, and engagement insights.

## Verification

Run locally:

```powershell
.\.venv\Scripts\python.exe -m py_compile backend\main.py backend\schemas.py backend\api\analytics.py backend\services\gamification.py
Invoke-RestMethod "http://127.0.0.1:8000/analytics/gamification/1?days=30" | ConvertTo-Json -Depth 6
cd frontend
npm run build
```
