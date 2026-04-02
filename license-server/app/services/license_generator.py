"""
License key generator for License Server
"""

import hashlib
import secrets
from typing import Tuple


def generate_license_key(edition: str, company_id: str) -> str:
    """
    Generates a license key for Elements Platform
    
    Format: ELEM-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
    
    Where:
    - ELEM: Prefix
    - CORE/ENTP: Edition code (embedded in first block)
    - 5 blocks: Random hex characters
    - Last block: Checksum
    
    Args:
        edition: "core" or "enterprise"
        company_id: Company UUID as string
        
    Returns:
        License key string
    """
    
    # Edition code
    edition_code = "CORE" if edition == "core" else "ENTP"
    
    # Generate 5 random blocks (4 chars each)
    blocks = []
    for _ in range(5):
        block = secrets.token_hex(2).upper()  # 4 hex chars
        blocks.append(block)
    
    # Create checksum from blocks + company_id
    checksum_data = f"{''.join(blocks)}{company_id}{edition_code}"
    checksum = hashlib.sha256(checksum_data.encode()).hexdigest()[:4].upper()
    
    # Combine into final key
    # Format: ELEM-CORE/ENTP-XXXX-XXXX-XXXX-XXXX-XXXX-CHKS
    license_key = f"ELEM-{edition_code}-{'-'.join(blocks)}-{checksum}"
    
    return license_key


def validate_license_key_format(license_key: str) -> Tuple[bool, str]:
    """
    Validates license key format
    
    Args:
        license_key: License key to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    
    parts = license_key.split('-')
    
    # Should have 9 parts: ELEM + EDITION + 5 blocks + checksum
    if len(parts) != 8:
        return False, "Invalid license key format (wrong number of parts)"
    
    # Check prefix
    if parts[0] != "ELEM":
        return False, "Invalid license key prefix"
    
    # Check edition code
    if parts[1] not in ("CORE", "ENTP"):
        return False, "Invalid edition code"
    
    # Check block lengths (should be 4 chars each)
    for i in range(2, 7):
        if len(parts[i]) != 4:
            return False, f"Invalid block length at position {i}"
        # Check if hex
        try:
            int(parts[i], 16)
        except ValueError:
            return False, f"Invalid hex characters in block {i}"
    
    # Check checksum length
    if len(parts[7]) != 4:
        return False, "Invalid checksum length"
    
    return True, ""


def extract_edition_from_key(license_key: str) -> str:
    """
    Extracts edition from license key
    
    Args:
        license_key: License key
        
    Returns:
        "core" or "enterprise"
    """
    parts = license_key.split('-')
    if len(parts) >= 2:
        edition_code = parts[1]
        return "core" if edition_code == "CORE" else "enterprise"
    return "unknown"
