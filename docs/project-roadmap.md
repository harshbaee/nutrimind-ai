# NutriMind AI Project Roadmap

NutriMind AI is an AI-powered nutrition, meal cost, and food optimisation platform. Its product identity is not just calorie tracking; it helps users understand whether their food choices are nutritionally efficient for their budget.

## Product Positioning

Most nutrition apps answer: "How many calories did I eat?"

NutriMind AI should answer:

- Which foods give me the best protein per euro?
- Which meals are hurting my budget or goals?
- What cheaper substitutions preserve nutrition quality?
- How can I build a meal plan that meets calories, protein, and budget?
- Are my habits becoming more consistent over time?

## MVP Goal

Build a working analytics platform that supports one complete user loop:

1. Search or add food products.
2. Save products with nutrition and estimated price.
3. Log meals with quantities.
4. Track daily nutrition and food spending.
5. Show efficiency and cost analytics.
6. Generate simple recommendations from logged data.

## Current Backend Coverage

- `GET /food/search`: OpenFoodFacts product search.
- `GET /food/barcode/{barcode}`: barcode lookup.
- `POST /food/save`: save products locally.
- `POST /meals/log`: log a meal and update daily spending.
- `GET /meals/history/{user_id}`: recent meal history.
- `GET /nutrition/efficiency/{product_id}`: product efficiency metrics.
- `GET /nutrition/rankings`: protein efficiency rankings.
- `GET /nutrition/daily-summary/{user_id}`: today's summary.
- `GET /analytics/spending/{user_id}`: recent spending history.
- `GET /analytics/meal-types/{user_id}`: meal type breakdown.
- `GET /analytics/weekly-summary/{user_id}`: weekly summary.

## Phase 1: Solid MVP

Focus: make the existing product loop reliable and demo-ready.

- Add user creation and profile endpoints.
- Add product update endpoint for estimated price.
- Add meal delete/update endpoints so logs are correctable.
- Return full macro totals from meal history and analytics endpoints.
- Add API schemas for clean request and response validation.
- Add seed data for a demo user and sample products.
- Add frontend dashboard screens:
  - food search
  - saved products
  - meal logger
  - daily summary
  - cost analytics
  - efficiency rankings

## Phase 2: Recommendation Engine

Focus: useful rule-based intelligence before heavier ML.

- Recommend high-protein, lower-cost substitutes from saved products.
- Flag expensive low-protein foods.
- Detect budget overruns against weekly budget.
- Detect low protein days against user goal.
- Generate recommendation records in the database.
- Add frontend recommendation cards.

Example:

> Replace Product A with Product B to save 35% while keeping similar protein.

## Phase 3: Optimisation Engine

Focus: signature meal planning feature.

- Add user inputs:
  - calorie target
  - protein target
  - daily budget
  - dietary preference
- Use OR-Tools or linear programming to select products/meals.
- Return:
  - optimised meal plan
  - total cost
  - total macros
  - shopping list
  - constraint warnings

## Phase 4: Behavioural Analytics

Focus: turn logs into product analytics.

- Meal consistency score.
- Protein adherence score.
- Budget adherence score.
- Late-night snack detection if meal timestamps are reliable.
- Calorie spike detection.
- Weekly trend cards.

## Phase 5: Predictive Analytics

Focus: recruiter-visible data science.

- Spending forecast.
- Protein goal adherence forecast.
- Calorie surplus or deficit projection.
- Simple anomaly detection for extreme calorie or spending days.
- Notebook-to-service workflow for models that graduate into the API.

## Suggested Next Build Slice

The next best slice is the MVP product loop:

1. Add `/users` endpoints.
2. Add product price editing.
3. Add demo seed data.
4. Build a simple frontend dashboard that consumes the current backend.

This creates a complete demo before adding heavier AI features.

## Recruiter Story

NutriMind AI demonstrates:

- full-stack product engineering
- analytics engineering
- applied data science
- optimisation
- API integration
- dashboard design
- product thinking around budget and health behaviour

The project should feel like a small SaaS product, not a notebook demo.
