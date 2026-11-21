import hashlib
import hmac
import secrets
import time
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from database.database import get_db
from models.models import AuthSession, Meal, Product, User

SESSION_DAYS = 30
SCRYPT = {"n": 2**14, "r": 8, "p": 1}  # OWASP's minimum for scrypt; ~50 ms per hash


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, dklen=32, **SCRYPT)
    return f"scrypt${SCRYPT['n']}${SCRYPT['r']}${SCRYPT['p']}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        _, n, r, p, salt, digest = stored.split("$")
        candidate = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), dklen=32, n=int(n), r=int(r), p=int(p))
    except ValueError:
        return False
    return hmac.compare_digest(candidate.hex(), digest)


# Burns the same scrypt time for unknown emails, so response time doesn't reveal which emails have accounts.
_DUMMY_HASH = hash_password(secrets.token_hex(8))


def check_login(db: Session, email: str, password: str) -> User | None:
    user = db.query(User).filter(User.email == email).first()
    ok = verify_password(password, user.password_hash if user else _DUMMY_HASH)
    return user if user and ok else None


# shortcut: failed logins are counted in this process's memory, so a restart clears them and several
# server processes each count separately; move the counter to the database or Redis before scaling out.
MAX_FAILURES, FAILURE_WINDOW_S = 5, 15 * 60
_failures: dict[str, list[float]] = defaultdict(list)


def login_blocked(email: str) -> bool:
    now = time.monotonic()
    _failures[email] = [t for t in _failures[email] if now - t < FAILURE_WINDOW_S]
    return len(_failures[email]) >= MAX_FAILURES


def record_failure(email: str) -> None:
    _failures[email].append(time.monotonic())


def clear_failures(email: str) -> None:
    _failures.pop(email, None)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(32)
    db.query(AuthSession).filter(AuthSession.expires_at < datetime.now()).delete(synchronize_session=False)
    db.add(AuthSession(token_hash=_token_hash(token), user_id=user.id, expires_at=datetime.now() + timedelta(days=SESSION_DAYS)))
    db.commit()
    return token


def end_session(db: Session, token: str) -> None:
    db.query(AuthSession).filter(AuthSession.token_hash == _token_hash(token)).delete(synchronize_session=False)
    db.commit()


bearer = HTTPBearer(auto_error=False)  # also adds the "Authorize" button to /docs


def current_token(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> str:
    if not credentials:
        raise HTTPException(status_code=401, detail="Log in to continue", headers={"WWW-Authenticate": "Bearer"})
    return credentials.credentials


def current_user(token: str = Depends(current_token), db: Session = Depends(get_db)) -> User:
    session = db.query(AuthSession).filter(AuthSession.token_hash == _token_hash(token)).first()
    if not session or session.expires_at < datetime.now():
        raise HTTPException(status_code=401, detail="Your login has expired. Log in again.", headers={"WWW-Authenticate": "Bearer"})
    return db.query(User).filter(User.id == session.user_id).one()


def _int_param(request: Request, name: str) -> int | None:
    try:
        return int(request.path_params[name])
    except (KeyError, ValueError):
        return None  # absent, or not a number (the route's own validation answers that with a 422)


def authorize(request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)) -> User:
    """Runs before every user-data route: a {user_id} in the path must be you, a {meal_id} or {product_id}
    must be yours."""
    user_id = _int_param(request, "user_id")
    if user_id is not None and user_id != user.id:
        raise HTTPException(status_code=403, detail="That isn't your account")
    meal_id = _int_param(request, "meal_id")
    if meal_id is not None:
        owner = db.query(Meal.user_id).filter(Meal.id == meal_id).scalar()
        if owner is not None and owner != user.id:
            raise HTTPException(status_code=404, detail="Meal not found")  # don't confirm other people's meals exist
    product_id = _int_param(request, "product_id")
    if product_id is not None:
        owner = db.query(Product.user_id).filter(Product.id == product_id).scalar()
        if owner is not None and owner != user.id:
            raise HTTPException(status_code=404, detail="Product not found")
    request.state.user = user
    return user


def require_self(request: Request, user_id: int) -> None:
    """For routes that take user_id in the request body rather than the path."""
    if user_id != request.state.user.id:
        raise HTTPException(status_code=403, detail="That isn't your account")
