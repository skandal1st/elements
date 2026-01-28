import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes


def _derive_key(master_password: str, salt: bytes, iterations: int = 200_000) -> bytes:
    if not master_password:
        raise ValueError("master_password пустой")
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,  # 256-bit
        salt=salt,
        iterations=iterations,
    )
    return kdf.derive(master_password.encode("utf-8"))


def encrypt_secret(master_password: str, plaintext: str) -> tuple[bytes, bytes, bytes]:
    """
    Шифрует secret AES-256-GCM.
    Возвращает (salt, nonce, ciphertext).
    """
    salt = os.urandom(16)
    nonce = os.urandom(12)  # recommended for GCM
    key = _derive_key(master_password, salt)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), associated_data=None)
    return salt, nonce, ciphertext


def decrypt_secret(master_password: str, salt: bytes, nonce: bytes, ciphertext: bytes) -> str:
    key = _derive_key(master_password, salt)
    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(nonce, ciphertext, associated_data=None)
    return plaintext.decode("utf-8")

