import os
from datetime import datetime, timedelta

import bcrypt
from jose import jwt

SECRET_KEY = os.getenv("JWT_SECRET", "change-this-secret-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(email: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": email, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> str:
    """Returns the email (sub) from a valid token, or raises JWTError."""
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return payload["sub"]
