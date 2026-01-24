"""
Role-Based Access Control (RBAC) for Elements modules.

Each module has its own role system:
- hr: admin, manager, specialist, viewer
- it: admin, it_specialist, employee
- finance: admin, accountant, economist, viewer

User roles are stored in JWT as:
{"hr": "admin", "it": "user", "finance": "viewer"}
"""

from typing import Sequence


class ModuleRBAC:
    """Role-based access control for a specific module."""

    def __init__(self, module_name: str):
        """
        Initialize RBAC for a module.

        Args:
            module_name: Module identifier (hr, it, finance, etc.)
        """
        self.module_name = module_name

    def get_user_role(self, roles: dict[str, str]) -> str | None:
        """
        Get user's role in this module.

        Args:
            roles: User roles dict from JWT

        Returns:
            Role string or None if user has no role in this module
        """
        return roles.get(self.module_name)

    def has_access(self, roles: dict[str, str], is_superuser: bool = False) -> bool:
        """
        Check if user has any access to this module.

        Args:
            roles: User roles dict from JWT
            is_superuser: Superuser bypass flag

        Returns:
            True if user can access this module
        """
        if is_superuser:
            return True
        return self.module_name in roles

    def has_role(
        self,
        roles: dict[str, str],
        required_roles: Sequence[str],
        is_superuser: bool = False,
    ) -> bool:
        """
        Check if user has one of the required roles.

        Args:
            roles: User roles dict from JWT
            required_roles: List of acceptable roles
            is_superuser: Superuser bypass flag

        Returns:
            True if user has one of required roles
        """
        if is_superuser:
            return True

        user_role = self.get_user_role(roles)
        if user_role is None:
            return False

        return user_role in required_roles

    def is_admin(self, roles: dict[str, str], is_superuser: bool = False) -> bool:
        """
        Check if user is admin in this module.

        Args:
            roles: User roles dict from JWT
            is_superuser: Superuser bypass flag

        Returns:
            True if user is admin
        """
        if is_superuser:
            return True
        return self.get_user_role(roles) == "admin"


# Pre-configured RBAC instances for each module
hr_rbac = ModuleRBAC("hr")
it_rbac = ModuleRBAC("it")
finance_rbac = ModuleRBAC("finance")
doc_rbac = ModuleRBAC("doc")
