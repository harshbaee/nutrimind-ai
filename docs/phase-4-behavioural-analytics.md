# Phase 4: Behavioural Analytics

Phase 4 turns meal logs into behavioural product analytics. The goal is to help users understand consistency, adherence, and recurring patterns rather than only showing raw calories.

## Backend Endpoint

```http
GET /analytics/behaviour/{user_id}?days=30
```

`days` supports a range from 7 to 90.

## Metrics

The endpoint returns:

- meal consistency score
- calorie adherence score
- protein adherence score
- budget adherence score
- overall adherence score
- late-night meal count
- calorie spike days
- overspending days
- low-protein days
- daily behavioural rows
- insight cards

## Scoring

The current version is deterministic and explainable:

- **Meal consistency** is based on logged days divided by the selected period.
- **Calorie adherence** scores logged days by distance from the user's calorie goal.
- **Protein adherence** scores logged days against the user's protein target.
- **Budget adherence** compares daily spend against weekly budget divided by seven.
- **Overall adherence** combines consistency, calories, protein, and budget.

## Pattern Flags

Daily rows can include:

- `calorie_spike`
- `overspending`
- `low_protein`
- `late_meal`
- `low_meal_frequency`

## Frontend

The dashboard now includes a **Behavioural analytics** panel.

It displays:

- four adherence score cards
- calories/protein trend chart
- meal frequency chart
- pattern counters
- insight cards

## Local Demo Result

For the current demo user over 30 days:

- days logged: `4`
- overall adherence: `32.24%`
- low-protein days: `4`
- overspending days: `0`

The low score is expected with the current demo data because only a few old meals exist in the 30-day period.
