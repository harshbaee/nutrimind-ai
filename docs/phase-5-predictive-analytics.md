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

## v2: model selection and robust anomalies

`backend/services/predictive.py` now fits three small forecasting models to each user's own logged days, separately for calories, protein and cost:

- `mean`: the average logged day
- `weekday`: the average for each day of the week, pulled toward the overall average when a weekday has few logs
- `damped_trend`: Holt's linear smoothing with a damped trend, started from a line fitted to the first week

Each model is replayed over the user's history, predicting every logged day from the days before it. The plain mean is kept unless another model's error is at least 10% lower. With fewer than 6 logged days the mean is used and `model_type` is `average_baseline_v2`; otherwise it names the model chosen per metric.

Anomalies use the modified z-score (median and median absolute deviation, flagged above 3.5), which one spike cannot drag the way it drags a mean and standard deviation. Flagged spikes are left out before the forecast is fitted, so one party or holiday meal is reported rather than learned as the new normal. The goal and budget rules (protein below 65% of goal, calories below 50%, spend above 125% of the daily budget) still apply.

### Backtest

`notebooks/forecast_backtest.py` simulates 400 users with known patterns (weekday rhythm, slow drift, noise, skipped days, injected spikes), gives each method the 30-day window the API uses, and scores the next 7 days. Calories, seed 7:

| Method | 7-day error (kcal/day) |
|---|---|
| v1 trend blend | 271.1 |
| v2 selected | 221.5 |
| mean, spikes left in | 259.7 |
| mean, spikes removed | 228.4 |
| weekday, spikes removed | 222.0 |
| damped trend, spikes removed | 252.1 |

| Spike detection | Precision | Recall |
|---|---|---|
| v1 mean/std rule | 74% | 88% |
| v2 median/MAD rule | 94% | 86% |

Most of the forecast gain comes from removing spikes before fitting; selection then matches the best single model without knowing in advance which it is. These are simulated users built to the patterns described above, so they show the methods behave as designed, not how they do on real logs. Re-run the script on real data once there is enough of it.
