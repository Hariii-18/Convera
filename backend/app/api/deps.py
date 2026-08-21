from fastapi import Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.core.security import InvalidTokenError, decode_access_token
from app.crud.user import get_user_by_id
from app.db.session import get_db
from app.models.user import User


security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    credentials_error = AppError(
        "Could not validate credentials",
        status.HTTP_401_UNAUTHORIZED,
    )

    if credentials is None:
        raise credentials_error

    token = credentials.credentials

    try:
        subject = decode_access_token(token)
        user_id = int(subject)
    except (InvalidTokenError, ValueError):
        raise credentials_error from None

    user = get_user_by_id(db, user_id)

    if user is None:
        raise credentials_error

    if not user.is_active:
        raise AppError(
            "Inactive user",
            status.HTTP_403_FORBIDDEN,
        )

    return user
