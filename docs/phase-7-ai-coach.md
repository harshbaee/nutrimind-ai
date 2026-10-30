# Phase 7 - AI Coach Briefing

Phase 7 adds a local coach layer that turns NutriMind AI's analytics into a concise action plan. It does not require an external LLM key yet; the first version uses deterministic reasoning over the app's own nutrition, budget, behaviour, forecast, recommendation, and gamification signals.

## Backend

- Added `backend/services/coach.py`.
- Added `backend/api/coach.py`.
- Mounted the router under `/coach`.
- Added `GET /coach/briefing/{user_id}?days=30`.
- Added `POST /coach/ask?days=30`.
- Added Pydantic models for coach metric cards, actions, risk flags, briefings, and question answers.

The briefing combines:

- today's calories, protein, and cost
- recent weekly spend
- behavioural adherence
- predictive risk flags
- gamification momentum
- existing recommendations
- best protein-per-euro product context

## Frontend

- Added `CoachBriefingPanel`.
- Added coach API client types and query hook.
- Rendered the coach briefing near the top of the dashboard.

The panel shows readiness score, focus area, summary cards, prioritized action plan, risk flags, quick talking points, and a small coach question flow.

## Verification

Run locally:

```powershell
.\.venv\Scripts\python.exe -m py_compile backend\main.py backend\schemas.py backend\api\coach.py backend\services\coach.py
Invoke-RestMethod "http://127.0.0.1:8000/coach/briefing/1?days=30" | ConvertTo-Json -Depth 6
Invoke-RestMethod "http://127.0.0.1:8000/coach/ask?days=30" -Method Post -ContentType "application/json" -Body '{"user_id":1,"question":"How can I improve protein?"}' | ConvertTo-Json -Depth 5
cd frontend
npm run build
```
