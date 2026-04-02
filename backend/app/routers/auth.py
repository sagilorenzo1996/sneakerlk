from fastapi import APIRouter, HTTPException

from app.auth_utils import create_access_token, hash_password, verify_password
from app.database import create_user, get_user_by_email
from app.models.schemas import LoginRequest, RegisterRequest, TokenResponse

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
async def register(payload: RegisterRequest):
    if get_user_by_email(payload.email):
        raise HTTPException(status_code=400, detail="Email already registered.")
    hashed = hash_password(payload.password)
    create_user(payload.email, hashed)
    token = create_access_token(payload.email)
    return TokenResponse(access_token=token, email=payload.email)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
    user = get_user_by_email(payload.email)
    if not user or not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = create_access_token(payload.email)
    return TokenResponse(access_token=token, email=payload.email)
