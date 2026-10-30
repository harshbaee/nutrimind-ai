# NutriMind AI 🧠🥗

An AI-powered nutrition, meal cost & food optimisation platform. It answers "which foods give me the best protein per euro?", not just "how many calories did I eat?".

## Stack
- **Backend:** FastAPI, SQLAlchemy, PostgreSQL (SQLite fallback for local dev)
- **Optimisation:** OR-Tools CP-SAT
- **Frontend:** React, TanStack Start, Tailwind CSS, Recharts (via Lovable)

## Status

| Phase | Feature | Doc |
|-------|---------|-----|
| 1 | MVP loop: food search (OpenFoodFacts), saved products, meal logging, daily/weekly analytics | [roadmap](docs/project-roadmap.md) |
| 2 | Rule-based recommendations (cheaper substitutes, budget/protein alerts) | [phase 2](docs/phase-2-recommendation-engine.md) |
| 3 | Budget-aware meal plan optimiser | [phase 3](docs/phase-3-optimisation-engine.md) |
| 4 | Behavioural analytics (adherence scores, pattern flags) | [phase 4](docs/phase-4-behavioural-analytics.md) |
| 5 | Predictive analytics (forecasts, anomalies, risk flags) | [phase 5](docs/phase-5-predictive-analytics.md) |
| 6 | Gamified insights (streaks, badges, challenges) | [phase 6](docs/phase-6-gamified-insights.md) |
| 7 | AI coach briefing + Q&A (deterministic, no LLM key needed) | [phase 7](docs/phase-7-ai-coach.md) |

## Run locally (Windows / PowerShell)

Backend: with no `DATABASE_URL` set it uses `backend/nutrimind.sqlite3`, so no database server is needed.

```powershell
python -m venv .venv
.\.venv\Scripts\pip install -r backend\requirements-dev.txt
.\.venv\Scripts\python backend\database\seed_demo.py
cd backend
..\.venv\Scripts\python -m uvicorn main:app --reload
```

API docs: http://127.0.0.1:8000/docs

To use PostgreSQL instead, put `DATABASE_URL=postgresql://user:pass@localhost:5432/nutrimind` in `.env` at the repo root, then run the seed script (it creates the tables).

Frontend (expects the API at `http://127.0.0.1:8000`; override with `VITE_API_BASE_URL`):

```powershell
cd frontend
npm install
npm run dev
```

Tests (seed a throwaway SQLite DB and hit every endpoint except the live OpenFoodFacts search):

```powershell
.\.venv\Scripts\python -m pytest backend\tests
```

## Project Structure
- `backend/api/` – FastAPI routers
- `backend/services/` – recommendation, optimiser, behavioural, predictive, gamification, coach logic
- `backend/database/` – engine, `schema.sql`, demo seed
- `frontend/` – dashboard app
- `docs/` – roadmap and per-phase notes

## Author
Harsh | [github.com/harshbaee](https://github.com/harshbaee)
