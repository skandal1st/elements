"""
Unified JWT handling for all Elements modules.

Token payload format:
{
    "sub": "user-uuid",
    "email": "user@example.com",
    "roles": {"hr": "admin", "it": "user", "finance": "viewer"},
    "is_superuser": false,
    "exp": 1234567890,
    "iat": 1234567890
}
"""

from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from jose import JWTError, jwt
from pydantic import BaseModel

# JWT algorithm - must match across all modules
ALGORITHM = "HS256"

# Default token expiration (12 hours)
DEFAULT_EXPIRE_MINUTES = 720


class TokenPayload(BaseModel):
    """Unified JWT payload for all Elements modules."""

    sub: str  # User ID (UUID as string)
    email: str
    roles: dict[str, str]  # {"hr": "admin", "it": "user", "finance": "viewer"}
    is_superuser: bool = False
    exp: datetime
    iat: datetime

    @property
    def user_id(self) -> UUID:
        """Get user ID as UUID."""
        return UUID(self.sub)


def create_access_token(
    secret_key: str,
    user_id: UUID | str,
    email: str,
    roles: dict[str, str] | None = None,
    is_superuser: bool = False,
    expires_minutes: int = DEFAULT_EXPIRE_MINUTES,
) -> str:
    """
    Create JWT access token with unified format.

    Args:
        secret_key: JWT signing secret
        user_id: User UUID
        email: User email
        roles: Module roles dict, e.g. {"hr": "admin", "it": "user"}
        is_superuser: Superuser bypass flag
        expires_minutes: Token expiration in minutes

    Returns:
        Encoded JWT token string
    """
    now = datetime.utcnow()
    expire = now + timedelta(minutes=expires_minutes)

    payload = {
        "sub": str(user_id),
        "email": email,
        "roles": roles or {},
        "is_superuser": is_superuser,
        "exp": expire,
        "iat": now,
    }

    return jwt.encode(payload, secret_key, algorithm=ALGORITHM)


def decode_token(token: str, secret_key: str) -> Optional[TokenPayload]:
    """
    Decode and validate JWT token.

    Args:
        token: JWT token string
        secret_key: JWT signing secret

    Returns:
        TokenPayload if valid, None otherwise
    """
    try:
        payload = jwt.decode(token, secret_key, algorithms=[ALGORITHM])
        return TokenPayload(**payload)
    except JWTError:
        return None


def verify_token(token: str, secret_key: str) -> bool:
    """
    Verify JWT token is valid without returning payload.

    Args:
        token: JWT token string
        secret_key: JWT signing secret

    Returns:
        True if token is valid, False otherwise
    """
    return decode_token(token, secret_key) is not None
