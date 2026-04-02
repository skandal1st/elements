"""
Edition management for Elements Platform.

Defines available editions (Core and Enterprise) and controls
which modules and integrations are available in each edition.
"""

from enum import Enum
from typing import List, Dict


class Edition(str, Enum):
    """Available product editions."""
    CORE = "core"
    ENTERPRISE = "enterprise"


# Current edition - set at build time via Dockerfile
# This value is replaced during Docker image build
CURRENT_EDITION = Edition.CORE


# Module availability mapping for each edition
EDITION_MODULES: Dict[Edition, List[str]] = {
    Edition.CORE: ["portal", "hr", "it"],
    Edition.ENTERPRISE: ["portal", "hr", "it", "tasks", "knowledge_core"]
}


# Integration availability mapping for IT module
EDITION_INTEGRATIONS: Dict[Edition, List[str]] = {
    Edition.CORE: ["email", "telegram", "ldap"],
    Edition.ENTERPRISE: ["email", "telegram", "ldap", "rocketchat", "zabbix"]
}


def get_allowed_modules() -> List[str]:
    """
    Returns the list of modules allowed in the current edition.

    Returns:
        List of module names (e.g., ["portal", "hr", "it"])
    """
    return EDITION_MODULES[CURRENT_EDITION]


def get_allowed_integrations() -> List[str]:
    """
    Returns the list of integrations allowed in the current edition.

    Returns:
        List of integration names (e.g., ["email", "telegram"])
    """
    return EDITION_INTEGRATIONS[CURRENT_EDITION]


def is_module_allowed(module: str) -> bool:
    """
    Checks if a module is allowed in the current edition.

    Args:
        module: Module name to check (e.g., "tasks")

    Returns:
        True if the module is available in current edition, False otherwise
    """
    return module in EDITION_MODULES[CURRENT_EDITION]


def is_integration_allowed(integration: str) -> bool:
    """
    Checks if an integration is allowed in the current edition.

    Args:
        integration: Integration name to check (e.g., "rocketchat")

    Returns:
        True if the integration is available in current edition, False otherwise
    """
    return integration in EDITION_INTEGRATIONS[CURRENT_EDITION]


def get_edition_name() -> str:
    """
    Returns the human-readable name of the current edition.

    Returns:
        Edition name (e.g., "Core", "Enterprise")
    """
    return "Enterprise" if CURRENT_EDITION == Edition.ENTERPRISE else "Core"
