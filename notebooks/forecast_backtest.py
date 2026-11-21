# %% [markdown]
# # Forecast and anomaly backtest
#
# Compares the v1 predictive layer (straight-line trend blended with the mean, mean/std outlier rule) with the
# v2 layer now in `backend/services/predictive.py` (per-metric model selection, median/MAD outlier rule).
#
# There is no real multi-user dataset yet, so this simulates users whose true pattern is known: a weekday
# rhythm, a slow drift, day-to-day noise, skipped logging days and injected spikes. Every model sees the same
# 30-day window the API uses and forecasts the next 7 days. Run from the repo root:
#
#     .venv\Scripts\python notebooks\forecast_backtest.py
#
# The `# %%` markers make it open as a notebook in VS Code or Jupyter (via jupytext).

# %%
import os
import random
import sys
from datetime import date, timedelta
from statistics import mean, pstdev

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))
from services.predictive import MODELS, ROBUST_Z_LIMIT, forecast_metric, robust_z  # noqa: E402

WINDOW, HORIZON, USERS = 30, 7, 400
TODAY = date(2026, 11, 21)


# %% [markdown]
# ## Simulated users
# Calories only: protein and cost follow the same shapes at a different scale, so one metric tells the story.

# %%
def simulate_user(rng: random.Random):
    base = rng.uniform(1700, 2800)
    weekend_lift = rng.choice([0, 0, rng.uniform(0.1, 0.3)])  # a third of users eat more at weekends
    drift = rng.choice([0, 0, rng.uniform(-8, 8)])  # a third drift up or down a few kcal a day
    noise = rng.uniform(0.06, 0.15)
    log_rate = rng.uniform(0.5, 0.95)

    def truth(d: date) -> float:
        day = (d - TODAY).days
        return base * (1 + (weekend_lift if d.weekday() >= 5 else 0)) + drift * day

    window, spikes = [], set()
    for offset in range(WINDOW - 1, -1, -1):
        d = TODAY - timedelta(days=offset)
        if rng.random() > log_rate:
            continue
        value = truth(d) * (1 + rng.gauss(0, noise))
        if rng.random() < 0.05:
            value *= rng.uniform(1.6, 2.2)  # a party, a holiday meal
            spikes.add(d)
        window.append((d, value))
    future = [TODAY + timedelta(days=h) for h in range(1, HORIZON + 1)]
    holdout = [(d, truth(d) * (1 + rng.gauss(0, noise))) for d in future]
    return window, holdout, spikes


# %% [markdown]
# ## v1, kept here as the baseline (copied from the previous `predictive.py`)

# %%
def v1_forecast(window, targets):
    values = [v for _, v in window]
    avg = mean(values)
    if len(window) < 7 or len(window) / WINDOW < 0.45:
        return [avg] * len(targets)
    xs = [(d - (TODAY - timedelta(days=WINDOW - 1))).days for d, _ in window]
    x_avg = mean(xs)
    slope = sum((x - x_avg) * (y - avg) for x, y in zip(xs, values)) / sum((x - x_avg) ** 2 for x in xs)
    out = []
    for t in targets:
        trend = avg + slope * ((t - (TODAY - timedelta(days=WINDOW - 1))).days - x_avg)
        out.append(max(0, trend * 0.55 + avg * 0.45))
    return out


def v1_outliers(window):
    values = [v for _, v in window]
    threshold = mean(values) + max(pstdev(values) * 1.75, 250) if len(values) > 1 else float("inf")
    return {d for d, v in window if v > threshold}


def v2_outliers(window):
    return {d for (d, _), z in zip(window, robust_z([v for _, v in window])) if z > ROBUST_Z_LIMIT}


# %% [markdown]
# ## Run

# %%
rng = random.Random(7)
errors = {"v1 trend blend": [], "v2 selected": [], "  mean, uncleaned": [], **{f"  {n} only": [] for n in MODELS}}
picked = {n: 0 for n in MODELS}
hits = {"v1": [0, 0, 0], "v2": [0, 0, 0]}  # true positives, flagged, real spikes

for _ in range(USERS):
    window, holdout, spikes = simulate_user(rng)
    if len(window) < 3:
        continue
    targets = [d for d, _ in holdout]
    actual = [v for _, v in holdout]

    def mae(pred):
        return mean(abs(p - a) for p, a in zip(pred, actual))

    errors["v1 trend blend"].append(mae(v1_forecast(window, targets)))
    v2_pred, chosen = forecast_metric(window, targets, upper=None)
    errors["v2 selected"].append(mae(v2_pred))
    picked[chosen] += 1
    # Single models on the same spike-cleaned window v2 uses, to separate model choice from cleaning.
    cleaned = [p for p, z in zip(window, robust_z([v for _, v in window])) if abs(z) <= ROBUST_Z_LIMIT]
    errors["  mean, uncleaned"].append(mae(MODELS["mean"](window, targets)))
    for name, model in MODELS.items():
        errors[f"  {name} only"].append(mae(model(cleaned, targets)))

    for label, flagged in (("v1", v1_outliers(window)), ("v2", v2_outliers(window))):
        hits[label][0] += len(flagged & spikes)
        hits[label][1] += len(flagged)
        hits[label][2] += len(spikes)

print(f"{USERS} simulated users, {WINDOW}-day window, {HORIZON}-day forecast (calories)\n")
print("7-day forecast error (MAE, kcal per day; lower is better)")
for name, errs in errors.items():
    print(f"  {name:<22} {mean(errs):7.1f}")
print("\nModel v2 picked:", ", ".join(f"{n} {c}" for n, c in picked.items()))
print("\nSpike detection        precision   recall")
for label, (tp, flagged, real) in hits.items():
    print(f"  {label:<20} {tp / max(flagged, 1):9.0%} {tp / max(real, 1):8.0%}")
