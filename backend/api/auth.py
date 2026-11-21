from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database.database import get_db
from models.models import User
from schemas import AuthResponse, LoginRequest, PasswordChange, SignUpRequest, UserResponse
from services.auth import (
    check_login,
    clear_failures,
    create_session,
    current_token,
    current_user,
    end_other_sessions,
    end_session,
    hash_password,
    login_blocked,
    record_failure,
    verify_password,
)

router = APIRouter()


@router.post("/signup", response_model=AuthResponse, status_code=201)
def signup(body: SignUpRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="That email already has an account. Log in instead.")
    user = User(**body.model_dump(exclude={"password"}), password_hash=hash_password(body.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="That email already has an account. Log in instead.")
    db.refresh(user)
    return AuthResponse(token=create_session(db, user), user=user)


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    if login_blocked(body.email):
        raise HTTPException(status_code=429, detail="Too many wrong passwords. Wait 15 minutes, then try again.")
    user = check_login(db, body.email, body.password)
    if not user:
        record_failure(body.email)
        raise HTTPException(status_code=401, detail="Wrong email or password")
    clear_failures(body.email)
    return AuthResponse(token=create_session(db, user), user=user)


@router.post("/logout", status_code=204)
def logout(token: str = Depends(current_token), db: Session = Depends(get_db)):
    end_session(db, token)


@router.post("/password", status_code=204)
def change_password(
    body: PasswordChange,
    token: str = Depends(current_token),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Needs the current password. Logs out every other session, so a stolen login stops working too."""
    if login_blocked(user.email):
        raise HTTPException(status_code=429, detail="Too many wrong passwords. Wait 15 minutes, then try again.")
    if not verify_password(body.current_password, user.password_hash):
        record_failure(user.email)
        raise HTTPException(status_code=400, detail="Your current password isn't right")
    clear_failures(user.email)
    user.password_hash = hash_password(body.new_password)
    db.commit()
    end_other_sessions(db, user, token)


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(current_user)):
    return user
