from fastapi import APIRouter, HTTPException, Depends, Query, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
import openfoodfacts
import requests
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database.database import get_db
from models.models import Product
from schemas import MealPhoto, ProductCreate, ProductPriceUpdate, ProductResponse, ProductUpdate
from services.photo import recognise_meal, vision_model

router = APIRouter()

# Configure the SDK with our User-Agent (required by OFF docs)
openfoodfacts.utils.get_logger()
API = openfoodfacts.API(
    user_agent="NutriMindAI/1.0",
    version=openfoodfacts.APIVersion.v2,
    country=openfoodfacts.Country.world,
    environment=openfoodfacts.Environment.org,  # use .net for staging
)

def pack_size_g(item: dict) -> float | None:
    # serving_size_g is the amount the price buys, so use the pack size, not OFF's serving_quantity.
    try:
        grams = float(item.get("product_quantity"))
    except (TypeError, ValueError):
        return None
    return grams if 0 < grams < 10000 else None


def parse_product(item: dict) -> dict:
    nutriments = item.get("nutriments", {})
    return {
        "barcode": item.get("code") or item.get("_id"),
        "name": item.get("product_name") or item.get("product_name_en") or "Unknown",
        "brand": item.get("brands", ""),
        "calories_per_100g": nutriments.get("energy-kcal_100g"),
        "protein_per_100g": nutriments.get("proteins_100g"),
        "carbs_per_100g": nutriments.get("carbohydrates_100g"),
        "fat_per_100g": nutriments.get("fat_100g"),
        "serving_size_g": pack_size_g(item),
        "category": (item.get("categories", "") or "").split(",")[0].strip(),
        "nutriscore": item.get("nutriscore_grade"),
        "nova_group": item.get("nova_group"),
    }

def openfoodfacts_error(exc: Exception) -> HTTPException:
    response = getattr(exc, "response", None)
    status_code = getattr(response, "status_code", None)

    if status_code:
        if 500 <= status_code < 600:
            return HTTPException(
                status_code=503,
                detail="OpenFoodFacts is temporarily unavailable. Please try again in a few minutes.",
            )
        if status_code == 429:
            return HTTPException(
                status_code=429,
                detail="OpenFoodFacts rate limit reached. Please try again shortly.",
            )
        if 400 <= status_code < 500:
            return HTTPException(
                status_code=502,
                detail="OpenFoodFacts rejected the request.",
            )

    message = str(exc)
    if "503 Server Error" in message or "Service Temporarily Unavailable" in message:
        return HTTPException(
            status_code=503,
            detail="OpenFoodFacts is temporarily unavailable. Please try again in a few minutes.",
        )

    return HTTPException(
        status_code=502,
        detail="Unable to reach OpenFoodFacts. Please try again shortly.",
    )


def get_product_or_404(product_id: int, db: Session) -> Product:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.get("/search")
def search_food(query: str, db: Session = Depends(get_db)):
    try:
        result = API.product.text_search(query, page=1, page_size=10)
        products = [parse_product(p) for p in result.get("products", [])]
        return {"query": query, "count": len(products), "results": products}
    except requests.RequestException as e:
        raise openfoodfacts_error(e)
    except Exception as e:
        raise openfoodfacts_error(e)

@router.get("/barcode/{barcode}")
def get_by_barcode(barcode: str, db: Session = Depends(get_db)):
    try:
        result = API.product.get(barcode, fields=[
            "code", "product_name", "brands", "nutriments",
            "product_quantity", "categories", "nutriscore_grade", "nova_group"
        ])
        # The SDK returns the product itself (not the raw API's {"status", "product"} wrapper), or None.
        if not result:
            raise HTTPException(status_code=404, detail="Product not found")
        return parse_product(result)
    except HTTPException:
        raise
    except requests.RequestException as e:
        raise openfoodfacts_error(e)
    except Exception as e:
        raise openfoodfacts_error(e)

@router.post("/photo")
def recognise_photo(body: MealPhoto, request: Request, db: Session = Depends(get_db)):
    """Foods recognised in a meal photo by your AI model, each matched to your pantry where possible."""
    if not vision_model():
        raise HTTPException(status_code=503, detail="Photo recognition needs the AI model set up (COACH_API_KEY and COACH_MODEL).")
    foods = recognise_meal(db, request.state.user.id, body.image)
    if foods is None:
        raise HTTPException(status_code=502, detail="The AI model didn't answer. Try again, or add the foods by hand.")
    return {"foods": foods}


@router.get("/saved", response_model=list[ProductResponse])
def saved_products(
    request: Request,
    search: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(Product).filter(Product.user_id == request.state.user.id)
    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))
    return query.order_by(Product.created_at.desc()).limit(limit).all()


@router.post("/save")
def save_product(product: ProductCreate, request: Request, db: Session = Depends(get_db)):
    user_id = request.state.user.id
    payload = product.model_dump(exclude_unset=True)
    if payload.get("barcode"):
        existing = db.query(Product).filter(Product.user_id == user_id, Product.barcode == payload.get("barcode")).first()
        if existing:
            return {"message": "Product already exists", "id": existing.id, "product": existing}

    new_product = Product(**payload, user_id=user_id)
    db.add(new_product)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Product barcode already exists")

    db.refresh(new_product)
    return {"message": "Product saved", "id": new_product.id, "product": new_product}


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    return get_product_or_404(product_id, db)


@router.patch("/{product_id}", response_model=ProductResponse)
def update_product(product_id: int, product_data: ProductUpdate, db: Session = Depends(get_db)):
    product = get_product_or_404(product_id, db)
    updates = product_data.model_dump(exclude_unset=True)

    if updates.get("barcode"):
        existing = db.query(Product).filter(
            Product.user_id == product.user_id, Product.barcode == updates["barcode"], Product.id != product_id
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail="Product barcode already exists")

    for field, value in updates.items():
        setattr(product, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Product barcode already exists")

    db.refresh(product)
    return product


@router.patch("/{product_id}/price", response_model=ProductResponse)
def update_product_price(
    product_id: int,
    price_data: ProductPriceUpdate,
    db: Session = Depends(get_db),
):
    product = get_product_or_404(product_id, db)
    product.estimated_price_eur = price_data.estimated_price_eur
    if price_data.serving_size_g is not None:
        product.serving_size_g = price_data.serving_size_g
    db.commit()
    db.refresh(product)
    return product
