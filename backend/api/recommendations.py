from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database.database import get_db
from models.models import Product, Recommendation, User
from schemas import RecommendationListResponse, RecommendationResponse
from services.recommendations import generate_user_recommendations

router = APIRouter()


def serialize_recommendation(recommendation: Recommendation, products_by_id: dict[int, Product]) -> RecommendationResponse:
    source = products_by_id.get(recommendation.source_product_id)
    suggested = products_by_id.get(recommendation.suggested_product_id)
    return RecommendationResponse(
        id=recommendation.id,
        user_id=recommendation.user_id,
        type=recommendation.type,
        message=recommendation.message,
        source_product_id=recommendation.source_product_id,
        source_product_name=source.name if source else None,
        suggested_product_id=recommendation.suggested_product_id,
        suggested_product_name=suggested.name if suggested else None,
        savings_eur=float(recommendation.savings_eur or 0) if recommendation.savings_eur is not None else None,
        created_at=recommendation.created_at,
    )


def recommendation_response(user_id: int, recommendations: list[Recommendation], db: Session) -> RecommendationListResponse:
    product_ids = {
        product_id
        for recommendation in recommendations
        for product_id in [recommendation.source_product_id, recommendation.suggested_product_id]
        if product_id
    }
    products = db.query(Product).filter(Product.id.in_(product_ids)).all() if product_ids else []
    products_by_id = {product.id: product for product in products}
    serialized = [serialize_recommendation(rec, products_by_id) for rec in recommendations]
    return RecommendationListResponse(user_id=user_id, count=len(serialized), recommendations=serialized)


@router.get("/{user_id}", response_model=RecommendationListResponse)
def list_recommendations(user_id: int, refresh: bool = False, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if refresh:
        recommendations = generate_user_recommendations(db, user_id)
    else:
        recommendations = (
            db.query(Recommendation)
            .filter(Recommendation.user_id == user_id)
            .order_by(Recommendation.created_at.desc(), Recommendation.id.desc())
            .limit(20)
            .all()
        )
        if not recommendations:
            recommendations = generate_user_recommendations(db, user_id)

    return recommendation_response(user_id, recommendations, db)


@router.post("/generate/{user_id}", response_model=RecommendationListResponse)
def generate_recommendations(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    recommendations = generate_user_recommendations(db, user_id)
    return recommendation_response(user_id, recommendations, db)
