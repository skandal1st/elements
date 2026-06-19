"""
Dev-инструмент: генерация тестового лицензионного ключа.

Использование:
    python scripts/dev/generate_test_license.py \
        --private-key license-server/keys/private.pem \
        --customer "ООО Ромашка" \
        --edition core \
        --modules hr,it,tasks,documents,contracts,mail,portal \
        --max-users 50 \
        --days 365 \
        --hardware-id <opt>

Печатает ELEM-LIC-v1.<payload>.<signature> в stdout.

Сначала сгенерируйте ключевую пару:
    openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 \
        -out license-server/keys/private.pem
    openssl rsa -pubout -in license-server/keys/private.pem \
        -out backend/core/license_pubkey.pem
"""
from __future__ import annotations

import argparse
import base64
import json
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa


def _b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode("ascii")


def main() -> int:
    parser = argparse.ArgumentParser(description="Сгенерировать тестовый лицензионный ключ Elements")
    parser.add_argument("--private-key", default="license-server/keys/private.pem")
    parser.add_argument("--customer", default="Dev Customer")
    parser.add_argument("--edition", default="core", choices=["core", "enterprise"])
    parser.add_argument(
        "--modules",
        default="hr,it,tasks,documents,contracts,mail,portal,knowledge_core",
        help="Список модулей через запятую",
    )
    parser.add_argument("--max-users", type=int, default=None)
    parser.add_argument("--days", type=int, default=365)
    parser.add_argument("--hardware-id", default=None, help="Привязка к hardware_id (опционально)")
    parser.add_argument(
        "--features",
        default="",
        help="key=value пары через запятую (например rocketchat=true,zabbix=false)",
    )
    args = parser.parse_args()

    private_path = Path(args.private_key)
    if not private_path.exists():
        print(f"ERROR: приватный ключ {private_path} не найден.", file=sys.stderr)
        print("Сгенерируйте: openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -out", private_path, file=sys.stderr)
        return 1

    private_key = serialization.load_pem_private_key(private_path.read_bytes(), password=None)
    if not isinstance(private_key, rsa.RSAPrivateKey):
        print("ERROR: приватный ключ должен быть RSA.", file=sys.stderr)
        return 1

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=args.days)

    features = {}
    if args.features:
        for part in args.features.split(","):
            if "=" not in part:
                continue
            k, v = part.split("=", 1)
            features[k.strip()] = v.strip().lower() in ("1", "true", "yes", "on")

    payload = {
        "license_id": str(uuid.uuid4()),
        "customer_name": args.customer,
        "edition": args.edition,
        "modules": [m.strip() for m in args.modules.split(",") if m.strip()],
        "max_users": args.max_users,
        "features": features,
        "hardware_id": args.hardware_id,
        "issued_at": now.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "expires_at": expires_at.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "issuer": "elements-vendor",
    }

    payload_bytes = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")

    signature = private_key.sign(
        payload_bytes,
        padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.MAX_LENGTH),
        hashes.SHA256(),
    )

    key = f"ELEM-LIC-v1.{_b64url(payload_bytes)}.{_b64url(signature)}"
    print(key)
    return 0


if __name__ == "__main__":
    sys.exit(main())
