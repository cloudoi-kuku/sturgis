"""
Authentication module for Sturgis Project
Handles user registration, login, and JWT token management
"""
import os
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from passlib.context import CryptContext
from jose import JWTError, jwt

from database import DatabaseService

# Security configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "sturgis-project-secret-key-change-in-production-2024")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# HTTP Bearer token security
security = HTTPBearer()

# Database instance
db = DatabaseService()

# Router
router = APIRouter(prefix="/api/auth", tags=["authentication"])


# ==================== MODELS ====================

class UserRegister(BaseModel):
    """Registration request model"""
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    company: Optional[str] = None


class UserLogin(BaseModel):
    """Login request model"""
    email: EmailStr
    password: str


class Token(BaseModel):
    """Token response model"""
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    """User response model (no password)"""
    id: str
    email: str
    name: str
    company: Optional[str] = None


# ==================== SECURITY FUNCTIONS ====================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Dependency to get the current authenticated user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = credentials.credentials
    payload = decode_token(token)

    if payload is None:
        raise credentials_exception

    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    user = db.get_user_by_id(user_id)
    if user is None:
        raise credentials_exception

    # Remove password hash from user dict
    user.pop("password_hash", None)
    return user


# ==================== ROUTES ====================

@router.post("/register", response_model=Token)
async def register(user_data: UserRegister):
    """Register a new user"""
    # Check if email already exists
    if db.email_exists(user_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Hash password and create user
    password_hash = get_password_hash(user_data.password)
    user_id = db.create_user(
        email=user_data.email,
        name=user_data.name,
        password_hash=password_hash,
        company=user_data.company
    )

    # Create access token
    access_token = create_access_token(data={"sub": user_id})

    # Get user data for response
    user = db.get_user_by_id(user_id)
    user.pop("password_hash", None)

    return Token(
        access_token=access_token,
        user=user
    )


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    """Login and get access token"""
    # Find user by email
    user = db.get_user_by_email(credentials.email)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Verify password
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Create access token
    access_token = create_access_token(data={"sub": user["id"]})

    # Remove password hash from response
    user.pop("password_hash", None)

    return Token(
        access_token=access_token,
        user=user
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user profile"""
    return UserResponse(**current_user)


@router.post("/verify")
async def verify_token(current_user: dict = Depends(get_current_user)):
    """Verify if the current token is valid"""
    return {"valid": True, "user": current_user}
