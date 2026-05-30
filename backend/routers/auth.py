from fastapi import APIRouter, Depends, HTTPException, status

from deps import get_current_user
from models import User
from schemas import LoginRequest, Token, UserCreate, UserOut
from security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
)
async def register(payload: UserCreate) -> User:
    if await User.exists(email=payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    user = await User.create(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
    )
    return user


@router.post("/login", response_model=Token)
async def login(payload: LoginRequest) -> Token:
    user = await User.get_or_none(email=payload.email)
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    return Token(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
