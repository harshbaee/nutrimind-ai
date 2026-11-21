# NutriMind AI

Nutrition, food cost and budget app: FastAPI + SQLAlchemy backend (`backend/`), React + TanStack Start frontend (`frontend/`). Run, test and deploy steps are in `README.md`.

## Current work

We are replacing hosted AI with models we train ourselves (food photo classifier, retriever, LoRA-tuned small LLM, RAG). Plan, decisions and integration points: `docs/ml-plan.md`. Training runs on the GTX 1650 laptop; the app also has to run on a CPU-only laptop.

## Rules

- Never commit `.claude/settings.json` or `.env`; they hold tokens and are git-ignored.
- No paid or hosted AI APIs. Ask before adding any external AI provider.
- Trained model files go in `ml/models/` (git-ignored) and ship as GitHub Release assets, not commits.
- Report model metrics only from held-out data, next to a baseline, and say when data is synthetic.
- Every route except `/` and `/auth/*` needs a login, and each account sees only its own data (pantry included). New routes taking a `user_id`, `meal_id` or `product_id` path parameter are checked by `authorize()` in `backend/services/auth.py`; body `user_id`s need `require_self()`.
- Backend tests: `.venv\Scripts\python -m pytest backend\tests` (they use a throwaway SQLite database). Frontend: `npx tsc --noEmit -p .` and `npm run build` in `frontend/`.
- Locally the backend uses the Postgres in `.env`. Schema changes go in `ensure_schema()` (`backend/models/models.py`) so existing databases upgrade on start.
- Demo login after seeding: `demo@nutrimind.ai` / `nutrimind-demo`.
- On the original laptop, uvicorn `--reload` misses file changes on the H: drive; restart the server after backend edits.
