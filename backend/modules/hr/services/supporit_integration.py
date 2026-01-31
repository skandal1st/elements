"""
Интеграция с SupportIT API.

Функции для взаимодействия с внешним SupportIT сервисом:
pull/push пользователей, получение оборудования, синхронизация.
"""

import httpx

from backend.core.config import settings


def _get_client_params() -> tuple[str, dict[str, str]] | None:
    """Базовые параметры для HTTP-клиента SupportIT."""
    if not settings.supporit_api_url or not settings.supporit_token:
        return None
    base_url = settings.supporit_api_url.rstrip("/")
    headers = {"Authorization": f"Bearer {settings.supporit_token}"}
    return base_url, headers


def _fetch_supporit_user_id(
    client: httpx.Client, base_url: str, email: str
) -> str | None:
    response = client.get(f"{base_url}/users")
    response.raise_for_status()
    payload = response.json()
    for user in payload.get("data", []):
        if user.get("email") == email:
            return user.get("id")
    return None


def fetch_supporit_users() -> list[dict]:
    params = _get_client_params()
    if not params:
        return []
    base_url, headers = params
    try:
        with httpx.Client(
            timeout=settings.supporit_timeout_seconds, headers=headers
        ) as client:
            response = client.get(f"{base_url}/users")
            response.raise_for_status()
            payload = response.json()
            return payload.get("data", [])
    except httpx.HTTPError:
        return []


def update_supporit_user(user_id: str, payload: dict) -> bool:
    params = _get_client_params()
    if not params:
        return False
    base_url, headers = params
    try:
        with httpx.Client(
            timeout=settings.supporit_timeout_seconds, headers=headers
        ) as client:
            response = client.put(f"{base_url}/users/{user_id}", json=payload)
            response.raise_for_status()
            return True
    except httpx.HTTPError:
        return False


def create_supporit_user(
    email: str,
    full_name: str,
    department: str | None = None,
    position: str | None = None,
    phone: str | None = None,
) -> dict | None:
    """Создать пользователя в SupportIT."""
    params = _get_client_params()
    if not params:
        return None
    base_url, headers = params
    body = {
        "email": email,
        "full_name": full_name,
        "department": department,
        "position": position,
        "phone": phone,
    }
    try:
        with httpx.Client(
            timeout=settings.supporit_timeout_seconds, headers=headers
        ) as client:
            response = client.post(f"{base_url}/users", json=body)
            response.raise_for_status()
            return response.json().get("data")
    except httpx.HTTPError:
        return None


def sync_users_to_supporit(users: list[dict]) -> dict:
    """Массовая синхронизация пользователей в SupportIT."""
    params = _get_client_params()
    if not params:
        return {"success": False, "error": "SupportIT not configured"}
    base_url, headers = params
    body = {"users": users}
    try:
        with httpx.Client(
            timeout=settings.supporit_timeout_seconds * 3, headers=headers
        ) as client:
            response = client.post(f"{base_url}/sync/users", json=body)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        return {"success": False, "error": str(e)}


def fetch_equipment_from_supporit(
    employee_id: int, email: str | None = None
) -> list[dict]:
    """Получить оборудование сотрудника из SupportIT API."""
    params = _get_client_params()
    if not params:
        return []
    base_url, headers = params
    try:
        with httpx.Client(
            timeout=settings.supporit_timeout_seconds, headers=headers
        ) as client:
            owner_id = str(employee_id)
            if email:
                resolved_id = _fetch_supporit_user_id(client, base_url, email)
                if resolved_id:
                    owner_id = resolved_id
            response = client.get(
                f"{base_url}/equipment", params={"owner_id": owner_id}
            )
            response.raise_for_status()
            payload = response.json()
            return payload.get("data", [])
    except httpx.HTTPError:
        return []
