# Phase 5 - Predictive Analytics

Phase 5 adds a first production-style forecasting layer to NutriMind AI. It is intentionally explainable and local: the backend uses recent logged meals, user goals, and budget settings to project the next forecast window and flag unusual nutrition or spending patterns.

## Backend

- Added `backend/services/predictive.py`.
- Added `GET /analytics/predictive/{user_id}?days=30&horizon=7`.
- Added Pydantic response models for forecast points, anomalies, insights, and risk flags.

The service groups meals by day, calculates recent logged-day baselines, applies a blended linear trend forecast, and caps projections so tiny demo datasets do not produce extreme values. It returns:

- next-window calorie, protein, and cost forecasts
- projected weekly spend
- projected weekly protein
- projected average daily calories
- budget, protein, and calorie risk flags
- anomaly messages for unusual calories, protein, or cost
- concise forecast insights

## Frontend

- Added `PredictiveAnalyticsPanel`.
- Added predictive API client types and query hook.
- Rendered the panel in the main dashboard after behavioural analytics.

The dashboard now shows forecast KPI cards, risk badges, a 7-day forecast chart, anomaly detection, and forecast insights.

## Verification

Run locally:

```powershell
.\.venv\Scripts\python.exe -m py_compile backend\main.py backend\schemas.py backend\api\analytics.py backend\services\predictive.py
Invoke-RestMethod "http://127.0.0.1:8000/analytics/predictive/1?days=30&horizon=7" | ConvertTo-Json -Depth 5
cd frontend
npm run build
```
