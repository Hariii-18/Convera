from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, user_in: UserCreate) -> User:
    user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=hash_password(user_in.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = get_user_by_email(db, email)
    if user is None or not verify_password(password, user.hashed_password):
        return None
    return user


def update_user(db: Session, user: User, user_in: UserUpdate) -> User:
    if user_in.full_name is not None:
        user.full_name = user_in.full_name
    if user_in.timezone is not None:
        user.timezone = user_in.timezone
    db.commit()
    db.refresh(user)
    return user


def change_password(
    db: Session, user: User, *, current_password: str, new_password: str
) -> bool:
    """Verifies `current_password` against the stored hash and, only if it
    matches, replaces it with `new_password`. Returns whether the change was
    applied so the caller can distinguish "wrong current password" (a normal
    rejection) from a real error. Never logs or returns either password.
    """
    if not verify_password(current_password, user.hashed_password):
        return False

    user.hashed_password = hash_password(new_password)
    db.commit()
    return True
