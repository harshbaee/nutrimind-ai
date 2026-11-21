# NutriMind API. Build from the repo root: docker build -f docker/backend.Dockerfile .
FROM python:3.12-slim

WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .

# Hosts such as Render and Railway set PORT; 8000 otherwise.
ENV PORT=8000
EXPOSE 8000

# The seed is idempotent: it creates the tables and adds the demo user and products only when missing.
CMD python database/seed_demo.py && uvicorn main:app --host 0.0.0.0 --port $PORT
