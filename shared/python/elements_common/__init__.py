"""
Elements Common - Shared utilities for Elements Platform modules.

This package provides:
- Unified JWT authentication
- Role-based access control (RBAC)
- Event bus for inter-module communication
- Module discovery and health checks
"""

__version__ = "1.0.0"

from elements_common.auth.jwt import (
    TokenPayload,
    create_access_token,
    decode_token,
)
from elements_common.auth.rbac import (
    ModuleRBAC,
    finance_rbac,
    hr_rbac,
    it_rbac,
)

__all__ = [
    "TokenPayload",
    "create_access_token",
    "decode_token",
    "ModuleRBAC",
    "hr_rbac",
    "it_rbac",
    "finance_rbac",
]
