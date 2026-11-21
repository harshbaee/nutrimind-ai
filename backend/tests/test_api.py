"""Smoke tests: seed the demo data into a throwaway SQLite DB and hit every endpoint."""
import os
import sys
import tempfile
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# Must be set before the database module is imported.
os.environ["DATABASE_URL"] = "sqlite:///" + os.path.join(tempfile.mkdtemp(), "test.sqlite3")
os.environ.pop("COACH_API_KEY", None)  # tests never call a real model

import pytest
from fastapi.testclient import TestClient

from api.food import parse_product
from database import seed_demo
from main import app

seed_demo.main()
client = TestClient(app)
USER_ID = client.get("/users/").json()[0]["id"]


@pytest.mark.parametrize(
    "path",
    [
        "/",
        f"/users/{USER_ID}",
        "/food/saved",
        f"/meals/history/{USER_ID}",
        "/nutrition/efficiency/1",
        "/nutrition/rankings",
        f"/nutrition/daily-summary/{USER_ID}",
        f"/analytics/spending/{USER_ID}",
        f"/analytics/meal-types/{USER_ID}",
        f"/analytics/weekly-summary/{USER_ID}",
        f"/analytics/behaviour/{USER_ID}?days=30",
        f"/analytics/predictive/{USER_ID}?days=30&horizon=7",
        f"/analytics/gamification/{USER_ID}?days=30",
        f"/recommendations/{USER_ID}",
        f"/coach/briefing/{USER_ID}?days=30",
    ],
)
def test_get_endpoints(path):
    assert client.get(path).status_code == 200


def test_unknown_user_is_404():
    assert client.get("/users/999999").status_code == 404


def test_log_then_delete_meal_updates_history():
    before = len(client.get(f"/meals/history/{USER_ID}").json())
    res = client.post(
        "/meals/log",
        json={"user_id": USER_ID, "name": "Test", "meal_type": "lunch", "items": [{"product_id": 2, "quantity_g": 100}]},
    )
    assert res.status_code == 201
    meal = res.json()["meal"]
    assert meal["total_protein"] > 0 and meal["total_cost_eur"] > 0
    assert len(client.get(f"/meals/history/{USER_ID}").json()) == before + 1

    assert client.delete(f"/meals/{meal['id']}").status_code == 200
    assert len(client.get(f"/meals/history/{USER_ID}").json()) == before


def test_optimizer_respects_budget():
    plan = client.post("/optimization/meal-plan", json={"user_id": USER_ID, "budget_eur": 8}).json()
    assert plan["items"]
    assert plan["totals"]["cost_eur"] <= 8


def test_recommendations_generate():
    res = client.post(f"/recommendations/generate/{USER_ID}")
    assert res.status_code == 200
    assert res.json()["count"] == len(res.json()["recommendations"])


def test_coach_answers_question():
    res = client.post("/coach/ask?days=30", json={"user_id": USER_ID, "question": "How can I improve protein?"})
    assert res.status_code == 200
    assert not any(s.startswith("AI coach") for s in res.json()["sources"])  # no key: rule-based answer


class FakeReply:
    """An OpenAI-style chat completion, as OmniRoute returns it."""
    def raise_for_status(self):
        pass

    def json(self):
        return {"choices": [{"message": {"content": "Add 200 g of Skyr to close the gap."}}]}


def use_ai_coach(monkeypatch, post):
    from services import coach
    monkeypatch.setenv("COACH_API_KEY", "test-key")
    monkeypatch.setenv("COACH_MODEL", "my-combo")
    monkeypatch.setenv("COACH_API_BASE_URL", "http://omniroute.test/v1/")
    monkeypatch.setattr(coach.requests, "post", post)
    coach._ai_cache.clear()


def test_coach_uses_ai_model_when_configured(monkeypatch):
    calls = []
    use_ai_coach(monkeypatch, lambda url, **kw: calls.append((url, kw)) or FakeReply())

    res = client.post("/coach/ask?days=30", json={"user_id": USER_ID, "question": "Cheapest protein?"}).json()
    assert res["answer"] == "Add 200 g of Skyr to close the gap."
    assert res["sources"][0] == "AI coach (my-combo)"
    url, kw = calls[-1]
    assert url == "http://omniroute.test/v1/chat/completions"
    assert kw["headers"]["Authorization"] == "Bearer test-key"
    assert kw["json"]["model"] == "my-combo"
    prompt = kw["json"]["messages"][1]["content"]
    assert "Cheapest protein?" in prompt and "saved_foods_best_protein_per_euro" in prompt

    briefing = client.get(f"/coach/briefing/{USER_ID}?days=30").json()
    assert briefing["headline"] == "Add 200 g of Skyr to close the gap."


def test_coach_falls_back_when_ai_model_fails(monkeypatch):
    from services import coach

    def down(url, **kw):
        raise coach.requests.ConnectionError("OmniRoute is not running")

    use_ai_coach(monkeypatch, down)
    res = client.post("/coach/ask?days=30", json={"user_id": USER_ID, "question": "How can I stay under budget?"})
    assert res.status_code == 200
    assert not res.json()["sources"][0].startswith("AI coach")


def test_rankings_use_cost_per_100g():
    rankings = client.get("/nutrition/rankings").json()["rankings"]
    # Rolled Oats 1kg at EUR 1.59 -> 16.9g protein / EUR 0.159 per 100g
    assert rankings[0]["name"] == "Rolled Oats 1kg"
    assert rankings[0]["protein_efficiency_score"] == pytest.approx(16.9 / 0.159, abs=0.01)
    scores = [r["protein_efficiency_score"] for r in rankings]
    assert scores == sorted(scores, reverse=True)


def test_search_result_uses_pack_size_not_serving():
    assert parse_product({"product_quantity": "750", "serving_quantity": 30})["serving_size_g"] == 750
    assert parse_product({"product_quantity": "abc", "serving_quantity": 30})["serving_size_g"] is None
    assert parse_product({"product_quantity": 25000})["serving_size_g"] is None


def test_weekly_summary_covers_seven_days():
    week = client.get(f"/analytics/weekly-summary/{USER_ID}").json()
    assert date.fromisoformat(week["week_start"]) == date.today() - timedelta(days=6)


def test_oversized_inputs_are_rejected():
    meal = {"user_id": USER_ID, "name": "Huge", "meal_type": "lunch", "items": [{"product_id": 2, "quantity_g": 5001}]}
    assert client.post("/meals/log", json=meal).status_code == 422
    assert client.patch("/food/2/price", json={"estimated_price_eur": 1, "serving_size_g": 10000}).status_code == 422


def daily_points(values, start=date(2026, 11, 2)):  # 2 Nov 2026 is a Monday
    return [(start + timedelta(days=i), v) for i, v in enumerate(values)]


def test_forecast_picks_weekday_model_for_weekend_pattern():
    from services.predictive import forecast_metric
    history = daily_points([2000 if (i % 7) < 5 else 3000 for i in range(28)])
    saturday = date(2026, 11, 28)
    forecast, model = forecast_metric(history, [saturday + timedelta(days=2), saturday], upper=None)
    assert model == "weekday"
    assert forecast[1] > forecast[0] + 500  # Saturday forecast well above Monday


def test_forecast_picks_trend_model_for_steady_rise():
    from services.predictive import forecast_metric
    history = daily_points([1500 + 30 * i for i in range(20)])
    forecast, model = forecast_metric(history, [date(2026, 11, 22)], upper=None)
    assert model == "damped_trend"
    # Follows the rise to near the last day (2,070), far above the 30-day mean (1,785); damping keeps it conservative.
    assert forecast[0] == pytest.approx(1500 + 30 * 19, rel=0.05)


def test_forecast_uses_mean_with_few_days_and_ignores_spikes():
    from services.predictive import forecast_metric, robust_z
    forecast, model = forecast_metric(daily_points([2000, 2100, 1900]), [date(2026, 11, 10)], upper=None)
    assert (model, forecast[0]) == ("mean", 2000)

    with_spike = daily_points([2000, 2050, 1950, 2000, 2020, 1980, 5000, 2010])
    assert max(robust_z([v for _, v in with_spike])) > 3.5
    forecast, _ = forecast_metric(with_spike, [date(2026, 11, 10)], upper=None)
    assert forecast[0] < 2100  # the 5000 kcal day is reported, not learned


def test_repeat_meal_logs_a_copy_now():
    first = client.get(f"/meals/history/{USER_ID}").json()[-1]  # the oldest seeded meal
    res = client.post(f"/meals/{first['id']}/repeat")
    assert res.status_code == 201
    copy = res.json()
    assert copy["meal"]["name"] == first["name"]
    assert copy["meal"]["id"] != first["id"]
    assert copy["meal"]["total_protein"] == pytest.approx(first["total_protein"], abs=0.01)
    assert copy["meal"]["logged_at"][:10] == date.today().isoformat()
    assert client.post("/meals/999999/repeat").status_code == 404
    client.delete(f"/meals/{copy['meal']['id']}")


def test_shopping_list_rounds_up_to_whole_packs():
    product = client.post("/food/save", json={
        "name": "Test Lentils 500g", "protein_per_100g": 24, "calories_per_100g": 350,
        "serving_size_g": 500, "estimated_price_eur": 1.20,
    }).json()["id"]
    meal = client.post("/meals/log", json={
        "user_id": USER_ID, "name": "Lentil stew", "meal_type": "dinner",
        "items": [{"product_id": product, "quantity_g": 700}],
    }).json()["meal"]["id"]

    shop = client.get(f"/analytics/shopping-list/{USER_ID}").json()
    lentils = next(i for i in shop["items"] if i["product_id"] == product)
    assert (lentils["grams"], lentils["packs"], lentils["cost_eur"]) == (700, 2, 2.40)  # 700 g needs two 500 g packs
    assert shop["total_eur"] == pytest.approx(sum(i["cost_eur"] or 0 for i in shop["items"]), abs=0.01)
    assert client.get("/analytics/shopping-list/999999").status_code == 404
    client.delete(f"/meals/{meal}")


def test_sign_up_creates_a_profile_and_rejects_duplicate_email():
    body = {"name": "Sam", "email": "sam@example.com", "calorie_goal": 2400, "protein_goal": 140, "budget_weekly": 60}
    res = client.post("/users/", json=body)
    assert res.status_code == 201
    assert res.json()["name"] == "Sam"
    assert client.post("/users/", json=body).status_code == 409


def test_barcode_lookup_parses_the_sdk_product(monkeypatch):
    from api import food
    sdk_product = {  # the SDK returns the product dict directly, or None when the barcode is unknown
        "code": "3017620422003", "product_name": "Nutella", "brands": "Ferrero", "product_quantity": "400",
        "nutriments": {"energy-kcal_100g": 539, "proteins_100g": 6.3, "carbohydrates_100g": 57.5, "fat_100g": 30.9},
    }
    monkeypatch.setattr(food.API.product, "get", lambda code, fields=None: sdk_product if code == "3017620422003" else None)
    found = client.get("/food/barcode/3017620422003").json()
    assert (found["name"], found["barcode"], found["protein_per_100g"], found["serving_size_g"]) == ("Nutella", "3017620422003", 6.3, 400)
    assert client.get("/food/barcode/0000000000000").status_code == 404
