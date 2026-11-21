import time
from datetime import date, timedelta

import requests

OPEN_PRICES_URL = "https://prices.openfoodfacts.org/api/v1/prices"
MAX_AGE_DAYS, MAX_SHOPS = 180, 8
CACHE_SECONDS = 60 * 60  # Open Prices is a free community service; don't ask twice an hour for the same food
_cache: dict[str, tuple[float, list[dict]]] = {}


def shop_prices(barcode: str) -> list[dict]:
    """Each shop's latest euro price for this barcode in the last six months, cheapest first.
    Raises requests.RequestException when Open Prices can't be reached."""
    hit = _cache.get(barcode)
    if hit and time.monotonic() - hit[0] < CACHE_SECONDS:
        return hit[1]
    res = requests.get(
        OPEN_PRICES_URL,
        params={"product_code": barcode, "currency": "EUR", "order_by": "-date", "size": 100},
        headers={"User-Agent": "NutriMindAI/1.0"},
        timeout=15,
    )
    res.raise_for_status()
    shops = latest_per_shop(res.json().get("items", []))
    if len(_cache) > 500:
        _cache.clear()
    _cache[barcode] = (time.monotonic(), shops)
    return shops


def latest_per_shop(items: list[dict], today: date | None = None) -> list[dict]:
    cutoff = ((today or date.today()) - timedelta(days=MAX_AGE_DAYS)).isoformat()
    latest: dict[tuple, dict] = {}
    for item in items:  # newest first, so the first price seen for a shop is its latest
        loc = item.get("location") or {}
        price, when = item.get("price"), str(item.get("date") or "")
        if item.get("currency") != "EUR" or not isinstance(price, (int, float)) or price <= 0 or when < cutoff:
            continue
        if item.get("price_per"):  # a price per kg or per unit, not for the pack this barcode identifies
            continue
        shop = (loc.get("osm_name") or "Unnamed shop", loc.get("osm_address_city") or "")
        latest.setdefault(shop, {
            "shop": shop[0],
            "city": shop[1] or None,
            "price_eur": round(float(price), 2),
            "date": when,
            "discounted": bool(item.get("price_is_discounted")),
        })
    return sorted(latest.values(), key=lambda s: s["price_eur"])[:MAX_SHOPS]
