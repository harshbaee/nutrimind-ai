import difflib
import json
import os
import re

from sqlalchemy.orm import Session

from models.models import Product
from services.coach import ai_chat

PHOTO_PROMPT = (
    "List the foods you can see in this meal photo with your best estimate of each one's weight in grams. "
    'Reply with JSON only, in this shape: {"foods": [{"name": "cooked white rice", "grams": 180}]}. '
    "Use plain food names, at most 10 foods. If there is no food in the photo, reply {\"foods\": []}."
)
MAX_FOODS, MAX_GRAMS = 10, 2000


def vision_model() -> str | None:
    """VISION_MODEL if set (a combo that can read images), otherwise the coach's model."""
    if not os.getenv("COACH_API_KEY"):
        return None
    return os.getenv("VISION_MODEL") or os.getenv("COACH_MODEL")


def parse_foods(reply: str) -> list[dict]:
    """The foods from the model's reply. Models often wrap JSON in prose or code fences, and can return junk,
    so anything that isn't a sensible name and weight is dropped rather than trusted."""
    match = re.search(r"\{.*\}", reply, re.DOTALL)
    try:
        data = json.loads(match.group(0)) if match else {}
    except json.JSONDecodeError:
        return []
    foods = []
    for item in data.get("foods", []) if isinstance(data, dict) else []:
        if not isinstance(item, dict):
            continue
        name, grams = str(item.get("name", "")).strip()[:100], item.get("grams")
        if name and isinstance(grams, (int, float)) and 0 < grams <= MAX_GRAMS:
            foods.append({"name": name, "grams": round(float(grams))})
    return foods[:MAX_FOODS]


def match_pantry(foods: list[dict], products: list[Product]) -> list[dict]:
    """Pair each recognised food with the closest-named food in the pantry, if any is close enough."""
    names = {p.name.lower(): p for p in products}
    out = []
    for food in foods:
        best = difflib.get_close_matches(food["name"].lower(), names, n=1, cutoff=0.5)
        # Also accept a pantry name containing the recognised name, e.g. "skyr" in "plain skyr 500g".
        if not best:
            best = [n for n in names if food["name"].lower() in n][:1]
        product = names[best[0]] if best else None
        out.append({**food, "product_id": product.id if product else None, "product_name": product.name if product else None})
    return out


def recognise_meal(db: Session, user_id: int, image_data_url: str) -> list[dict] | None:
    """Recognised foods matched to the user's pantry, or None when the AI isn't set up or didn't answer."""
    model = vision_model()
    if not model:
        return None
    reply = ai_chat(
        [{"role": "user", "content": [
            {"type": "text", "text": PHOTO_PROMPT},
            {"type": "image_url", "image_url": {"url": image_data_url}},
        ]}],
        model,
    )
    if reply is None:
        return None
    products = db.query(Product).filter(Product.user_id == user_id).all()
    return match_pantry(parse_foods(reply), products)
