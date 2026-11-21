"""Smoke tests: seed the demo data into a throwaway SQLite DB and hit every endpoint."""
import os
import sys
import tempfile
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# Must be set before the database module is imported.
os.environ["DATABASE_URL"] = "sqlite:///" + os.path.join(tempfile.mkdtemp(), "test.sqlite3")
os.environ.pop("ANTHROPIC_API_KEY", None)  # tests never call a real model
from types import SimpleNamespace

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
    assert not any(s.startswith("Claude") for s in res.json()["sources"])  # no key: rule-based answer


class FakeClaude:
    """Stands in for anthropic.Anthropic; records each request and replies with fixed text."""
    calls = []

    def __init__(self, **_):
        self.beta = self
        self.messages = self

    def create(self, **kwargs):
        FakeClaude.calls.append(kwargs)
        block = SimpleNamespace(type="text", text="Add 200 g of Skyr to close the gap.")
        return SimpleNamespace(stop_reason="end_turn", content=[block])


def test_coach_uses_claude_when_key_is_set(monkeypatch):
    from services import coach
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setattr(coach.anthropic, "Anthropic", FakeClaude)
    coach._claude_cache.clear()
    FakeClaude.calls.clear()

    res = client.post("/coach/ask?days=30", json={"user_id": USER_ID, "question": "Cheapest protein?"}).json()
    assert res["answer"] == "Add 200 g of Skyr to close the gap."
    assert res["sources"][0] == "Claude (claude-opus-5-5)"
    sent = FakeClaude.calls[-1]
    assert sent["model"] == "claude-opus-5-5"
    assert "Cheapest protein?" in sent["messages"][0]["content"]
    assert "saved_foods_best_protein_per_euro" in sent["messages"][0]["content"]

    briefing = client.get(f"/coach/briefing/{USER_ID}?days=30").json()
    assert briefing["headline"] == "Add 200 g of Skyr to close the gap."


def test_coach_falls_back_when_claude_fails(monkeypatch):
    from services import coach

    class Down(FakeClaude):
        def create(self, **kwargs):
            raise coach.anthropic.APIConnectionError(request=None)

    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setattr(coach.anthropic, "Anthropic", Down)
    coach._claude_cache.clear()

    res = client.post("/coach/ask?days=30", json={"user_id": USER_ID, "question": "How can I stay under budget?"})
    assert res.status_code == 200
    assert not res.json()["sources"][0].startswith("Claude")


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
