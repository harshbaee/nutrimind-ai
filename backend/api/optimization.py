from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database.database import get_db
from schemas import OptimizationRequest, OptimizationResponse
from services.auth import require_self
from services.optimizer import optimize_meal_plan

router = APIRouter()


@router.post("/meal-plan", response_model=OptimizationResponse)
def optimize_meal_plan_endpoint(request: OptimizationRequest, http: Request, db: Session = Depends(get_db)):
    require_self(http, request.user_id)
    try:
        return optimize_meal_plan(db, request)
    except ValueError as exc:
        message = str(exc)
        if message == "User not found":
            raise HTTPException(status_code=404, detail=message)
        raise HTTPException(status_code=400, detail=message)
