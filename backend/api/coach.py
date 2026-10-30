from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database.database import get_db
from schemas import CoachAnswerResponse, CoachBriefingResponse, CoachQuestionRequest
from services.coach import answer_coach_question, generate_coach_briefing

router = APIRouter()


@router.get("/briefing/{user_id}", response_model=CoachBriefingResponse)
def coach_briefing(
    user_id: int,
    days: int = Query(default=30, ge=7, le=90),
    db: Session = Depends(get_db),
):
    try:
        return generate_coach_briefing(db, user_id, days)
    except ValueError as exc:
        if str(exc) == "User not found":
            raise HTTPException(status_code=404, detail="User not found")
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/ask", response_model=CoachAnswerResponse)
def ask_coach(
    request: CoachQuestionRequest,
    days: int = Query(default=30, ge=7, le=90),
    db: Session = Depends(get_db),
):
    try:
        return answer_coach_question(db, request.user_id, request.question, days)
    except ValueError as exc:
        if str(exc) == "User not found":
            raise HTTPException(status_code=404, detail="User not found")
        raise HTTPException(status_code=400, detail=str(exc))
