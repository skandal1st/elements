"""
FastAPI authentication middleware and dependencies.

Usage:
    from elements_common.auth.middleware import get_current_user, require_roles

    @router.get("/")
    def endpoint(user: TokenPayload = Depends(get_current_user)):
        pass

    @router.get("/", dependencies=[Depends(require_roles("hr", ["admin", "manager"]))])
    def admin_endpoint():
        pass
"""

from typing import Callable, Sequence

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from elements_common.auth.jwt import TokenPayload, decode_token
from elements_common.auth.rbac import ModuleRBAC

# OAuth2 scheme - token from Authorization header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)


def create_get_current_user(secret_key: str) -> Callable:
    """
    Create get_current_user dependency with configured secret key.

    Args:
        secret_key: JWT signing secret

    Returns:
        FastAPI dependency function
    """

    async def get_current_user(
        token: str | None = Depends(oauth2_scheme),
    ) -> TokenPayload:
        """Get current user from JWT token."""
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )

        payload = decode_token(token, secret_key)
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return payload

    return get_current_user


def create_get_current_user_optional(secret_key: str) -> Callable:
    """
    Create optional get_current_user dependency.
    Returns None if no token or invalid token.

    Args:
        secret_key: JWT signing secret

    Returns:
        FastAPI dependency function
    """

    async def get_current_user_optional(
        token: str | None = Depends(oauth2_scheme),
    ) -> TokenPayload | None:
        """Get current user or None if not authenticated."""
        if not token:
            return None
        return decode_token(token, secret_key)

    return get_current_user_optional


def create_require_roles(
    module_name: str, secret_key: str
) -> Callable[[Sequence[str]], Callable]:
    """
    Create require_roles dependency factory.

    Args:
        module_name: Module identifier for RBAC
        secret_key: JWT signing secret

    Returns:
        Function that creates role-checking dependencies

    Usage:
        require_roles = create_require_roles("hr", settings.secret_key)

        @router.get("/", dependencies=[Depends(require_roles(["admin", "manager"]))])
        def endpoint():
            pass
    """
    rbac = ModuleRBAC(module_name)
    get_current_user = create_get_current_user(secret_key)

    def require_roles(allowed_roles: Sequence[str]) -> Callable:
        """Create dependency that checks user has one of allowed roles."""

        async def check_roles(
            user: TokenPayload = Depends(get_current_user),
        ) -> TokenPayload:
            if not rbac.has_role(user.roles, allowed_roles, user.is_superuser):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Insufficient permissions. Required roles: {list(allowed_roles)}",
                )
            return user

        return check_roles

    return require_roles


def create_require_module_access(module_name: str, secret_key: str) -> Callable:
    """
    Create dependency that checks user has any access to module.

    Args:
        module_name: Module identifier
        secret_key: JWT signing secret

    Returns:
        FastAPI dependency function
    """
    rbac = ModuleRBAC(module_name)
    get_current_user = create_get_current_user(secret_key)

    async def require_module_access(
        user: TokenPayload = Depends(get_current_user),
    ) -> TokenPayload:
        """Check user has access to this module."""
        if not rbac.has_access(user.roles, user.is_superuser):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No access to {module_name} module",
            )
        return user

    return require_module_access
