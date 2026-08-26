from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.exceptions import AppError
from app.core.security import create_access_token
from app.crud.user import (
    authenticate_user,
    change_password,
    create_user,
    get_user_by_email,
    update_user,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import (
    PasswordChangeRequest,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserRead,
    UserUpdate,
)

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _token_response(user: User) -> TokenResponse:
    access_token = create_access_token(subject=str(user.id))
    return TokenResponse(
        access_token=access_token,
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserRead.model_validate(user),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)) -> TokenResponse:
    if get_user_by_email(db, user_in.email) is not None:
        raise AppError("An account with this email already exists", status.HTTP_409_CONFLICT)

    user = create_user(db, user_in)
    return _token_response(user)


@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)) -> TokenResponse:
    user = authenticate_user(db, credentials.email, credentials.password)
    if user is None:
        raise AppError("Incorrect email or password", status.HTTP_401_UNAUTHORIZED)

    return _token_response(user)


@router.get("/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)


@router.patch("/me", response_model=UserRead)
def update_current_user(
    user_in: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserRead:
    user = update_user(db, current_user, user_in)
    return UserRead.model_validate(user)


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_current_user_password(
    password_in: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Changes the signed-in user's password. Requires the current password
    (rejected otherwise) and never echoes either password back. The existing
    access token stays valid -- this only rotates the stored hash, not the
    JWT signing secret or any session state.
    """
    ok = change_password(
        db,
        current_user,
        current_password=password_in.current_password,
        new_password=password_in.new_password,
    )
    if not ok:
        raise AppError("Current password is incorrect", status.HTTP_401_UNAUTHORIZED)
