from dataclasses import dataclass
from typing import List

import httpx
from ldap3 import ALL, Connection, Server

from app.core.config import settings
from app.utils.naming import generate_corporate_email


@dataclass
class ITAccountsResult:
    ad_account: str
    mailcow_account: str
    messenger_account: str


def create_ad_account(full_name: str) -> str:
    email = generate_corporate_email(full_name)
    return email.split("@", maxsplit=1)[0]


def create_mailbox(full_name: str) -> str:
    return generate_corporate_email(full_name)


def create_messenger_account(full_name: str) -> str:
    return f"msg.{full_name.lower().replace(' ', '.')}"


def provision_it_accounts(full_name: str) -> ITAccountsResult:
    return ITAccountsResult(
        ad_account=create_ad_account(full_name),
        mailcow_account=create_mailbox(full_name),
        messenger_account=create_messenger_account(full_name),
    )


def block_it_accounts(account_ids: List[str]) -> None:
    # Mock: no-op
    return None


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
    if not settings.supporit_api_url or not settings.supporit_token:
        return []
    base_url = settings.supporit_api_url.rstrip("/")
    headers = {"Authorization": f"Bearer {settings.supporit_token}"}
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
    if not settings.supporit_api_url or not settings.supporit_token:
        return False
    base_url = settings.supporit_api_url.rstrip("/")
    headers = {"Authorization": f"Bearer {settings.supporit_token}"}
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
    """Создать пользователя в SupportIT"""
    if not settings.supporit_api_url or not settings.supporit_token:
        return None
    base_url = settings.supporit_api_url.rstrip("/")
    headers = {"Authorization": f"Bearer {settings.supporit_token}"}
    payload = {
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
            response = client.post(f"{base_url}/users", json=payload)
            response.raise_for_status()
            return response.json().get("data")
    except httpx.HTTPError:
        return None


def sync_users_to_supporit(users: list[dict]) -> dict:
    """Массовая синхронизация пользователей в SupportIT"""
    if not settings.supporit_api_url or not settings.supporit_token:
        return {"success": False, "error": "SupportIT not configured"}
    base_url = settings.supporit_api_url.rstrip("/")
    headers = {"Authorization": f"Bearer {settings.supporit_token}"}
    payload = {"users": users}
    try:
        with httpx.Client(
            timeout=settings.supporit_timeout_seconds * 3, headers=headers
        ) as client:
            response = client.post(f"{base_url}/sync/users", json=payload)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        return {"success": False, "error": str(e)}


def create_supporit_ticket(title: str, description: str, category: str = "hr") -> bool:
    if not settings.supporit_api_url or not settings.supporit_token:
        return False
    base_url = settings.supporit_api_url.rstrip("/")
    headers = {"Authorization": f"Bearer {settings.supporit_token}"}
    payload = {
        "title": title,
        "description": description,
        "category": category,
        "priority": "medium",
    }
    try:
        with httpx.Client(
            timeout=settings.supporit_timeout_seconds, headers=headers
        ) as client:
            response = client.post(f"{base_url}/tickets", json=payload)
            response.raise_for_status()
            return True
    except httpx.HTTPError:
        return False


def ad_sync_users() -> list[dict]:
    if (
        not settings.ad_server
        or not settings.ad_user
        or not settings.ad_password
        or not settings.ad_base_dn
    ):
        return []
    server = Server(settings.ad_server, use_ssl=settings.ad_use_ssl, get_info=ALL)
    conn = Connection(
        server, user=settings.ad_user, password=settings.ad_password, auto_bind=True
    )
    conn.search(
        search_base=settings.ad_base_dn,
        search_filter="(objectClass=user)",
        attributes=[
            "cn",
            "givenName",
            "sn",
            "mail",
            "telephoneNumber",
            "department",
            "title",
            "sAMAccountName",
        ],
    )
    results = []
    for entry in conn.entries:
        results.append(
            {
                "full_name": str(entry.cn) if entry.cn else "",
                "first_name": str(entry.givenName) if entry.givenName else "",
                "last_name": str(entry.sn) if entry.sn else "",
                "email": str(entry.mail) if entry.mail else "",
                "phone": str(entry.telephoneNumber) if entry.telephoneNumber else "",
                "department": str(entry.department) if entry.department else "",
                "title": str(entry.title) if entry.title else "",
                "account": str(entry.sAMAccountName) if entry.sAMAccountName else "",
            }
        )
    conn.unbind()
    return results


def ad_create_user(email: str, full_name: str) -> str | None:
    if (
        not settings.ad_server
        or not settings.ad_user
        or not settings.ad_password
        or not settings.ad_base_dn
    ):
        return None
    server = Server(settings.ad_server, use_ssl=settings.ad_use_ssl, get_info=ALL)
    conn = Connection(
        server, user=settings.ad_user, password=settings.ad_password, auto_bind=True
    )
    account_name = email.split("@", maxsplit=1)[0]
    dn = f"CN={full_name},{settings.ad_base_dn}"
    conn.add(
        dn,
        ["top", "person", "organizationalPerson", "user"],
        {"sAMAccountName": account_name, "userPrincipalName": email},
    )
    conn.unbind()
    return account_name


def ad_disable_user(account_name: str) -> bool:
    if (
        not settings.ad_server
        or not settings.ad_user
        or not settings.ad_password
        or not settings.ad_base_dn
    ):
        return False
    server = Server(settings.ad_server, use_ssl=settings.ad_use_ssl, get_info=ALL)
    conn = Connection(
        server, user=settings.ad_user, password=settings.ad_password, auto_bind=True
    )
    conn.search(
        search_base=settings.ad_base_dn,
        search_filter=f"(sAMAccountName={account_name})",
        attributes=["distinguishedName"],
    )
    if not conn.entries:
        conn.unbind()
        return False
    dn = conn.entries[0].entry_dn
    conn.modify(dn, {"userAccountControl": [("MODIFY_REPLACE", [514])]})
    conn.unbind()
    return True


def mailcow_create_mailbox(email: str, full_name: str) -> bool:
    if not settings.mailcow_api_url or not settings.mailcow_api_key:
        return False
    base_url = settings.mailcow_api_url.rstrip("/")
    headers = {"X-API-Key": settings.mailcow_api_key}
    payload = {
        "local_part": email.split("@", maxsplit=1)[0],
        "domain": email.split("@", maxsplit=1)[1],
        "name": full_name,
        "quota": 1024,
        "active": 1,
    }
    try:
        with httpx.Client(
            timeout=settings.supporit_timeout_seconds, headers=headers
        ) as client:
            response = client.post(f"{base_url}/api/v1/add/mailbox", json=payload)
            response.raise_for_status()
            return True
    except httpx.HTTPError:
        return False


def mailcow_disable_mailbox(email: str) -> bool:
    if not settings.mailcow_api_url or not settings.mailcow_api_key:
        return False
    base_url = settings.mailcow_api_url.rstrip("/")
    headers = {"X-API-Key": settings.mailcow_api_key}
    payload = {"items": [email], "attr": {"active": 0}}
    try:
        with httpx.Client(
            timeout=settings.supporit_timeout_seconds, headers=headers
        ) as client:
            response = client.post(f"{base_url}/api/v1/edit/mailbox", json=payload)
            response.raise_for_status()
            return True
    except httpx.HTTPError:
        return False


def fetch_zup_employees() -> list[dict]:
    if (
        not settings.zup_api_url
        or not settings.zup_username
        or not settings.zup_password
    ):
        return []
    base_url = settings.zup_api_url.rstrip("/")
    try:
        with httpx.Client(timeout=settings.supporit_timeout_seconds) as client:
            response = client.get(
                base_url, auth=(settings.zup_username, settings.zup_password)
            )
            response.raise_for_status()
            payload = response.json()
            return payload.get("value", payload.get("data", []))
    except httpx.HTTPError:
        return []


def fetch_equipment_for_employee(
    employee_id: int, email: str | None = None
) -> list[dict]:
    if not settings.supporit_api_url or not settings.supporit_token:
        return []

    base_url = settings.supporit_api_url.rstrip("/")
    headers = {"Authorization": f"Bearer {settings.supporit_token}"}

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
