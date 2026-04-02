"""
License validation routes for License Server
"""

import logging
from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import License, Company, Activation
from ..schemas.license import (
    LicenseValidateRequest,
    LicenseValidateResponse,
    LicenseModulesResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/license", tags=["license"])


@router.post("/validate", response_model=LicenseValidateResponse)
async def validate_license(
    request: Request,
    data: LicenseValidateRequest,
    db: Session = Depends(get_db),
):
    """
    Validate a license for Elements Platform instance
    
    This endpoint is called by Elements Platform instances to validate their license.
    It checks:
    - Company exists and is active
    - License exists and is valid
    - License has not expired
    - Edition matches
    - Hardware ID is allowed (if hardware binding enabled)
    """
    
    # Get IP address
    ip_address = request.client.host if request.client else None
    
    # Find company
    company = db.query(Company).filter(Company.id == data.company_id).first()
    if not company:
        logger.warning(f"License validation failed: Company {data.company_id} not found")
        return LicenseValidateResponse(
            valid=False,
            error="Company not found"
        )
    
    if company.status != "active":
        logger.warning(f"License validation failed: Company {company.name} is {company.status}")
        return LicenseValidateResponse(
            valid=False,
            error=f"Company is {company.status}"
        )
    
    # Find active license for this company and edition
    license = db.query(License).filter(
        License.company_id == data.company_id,
        License.edition == data.edition,
        License.status == "active"
    ).first()
    
    if not license:
        logger.warning(f"License validation failed: No active {data.edition} license for company {company.name}")
        
        # Log failed activation
        activation = Activation(
            license_id=None,
            hardware_id=data.hardware_id,
            instance_version=data.version,
            ip_address=ip_address,
            result="failed",
            error_message="No active license found"
        )
        db.add(activation)
        db.commit()
        
        return LicenseValidateResponse(
            valid=False,
            error="No active license found for this edition"
        )
    
    # Check expiration
    if license.expires_at < datetime.utcnow():
        logger.warning(f"License validation failed: License expired for company {company.name}")
        
        # Update license status
        license.status = "expired"
        db.commit()
        
        # Log failed activation
        activation = Activation(
            license_id=license.id,
            hardware_id=data.hardware_id,
            instance_version=data.version,
            ip_address=ip_address,
            result="expired",
            error_message="License has expired"
        )
        db.add(activation)
        db.commit()
        
        return LicenseValidateResponse(
            valid=False,
            error=f"License expired on {license.expires_at.isoformat()}"
        )
    
    # Check hardware binding if enabled
    if license.bind_hardware:
        if license.allowed_hardware_ids and data.hardware_id not in license.allowed_hardware_ids:
            logger.warning(
                f"License validation failed: Hardware ID {data.hardware_id[:16]}... "
                f"not in allowed list for company {company.name}"
            )
            
            # Log failed activation
            activation = Activation(
                license_id=license.id,
                hardware_id=data.hardware_id,
                instance_version=data.version,
                ip_address=ip_address,
                result="failed",
                error_message="Hardware ID not allowed"
            )
            db.add(activation)
            db.commit()
            
            return LicenseValidateResponse(
                valid=False,
                error="Hardware ID not authorized for this license"
            )
    
    # Success - log activation
    activation = Activation(
        license_id=license.id,
        hardware_id=data.hardware_id,
        instance_version=data.version,
        ip_address=ip_address,
        result="success"
    )
    db.add(activation)
    db.commit()
    
    logger.info(
        f"License validation successful: Company {company.name}, "
        f"Edition {data.edition}, Hardware {data.hardware_id[:16]}..."
    )
    
    return LicenseValidateResponse(
        valid=True,
        edition=license.edition,
        expires_at=license.expires_at,
        modules=license.modules,
        max_users=license.max_users,
        features=license.features
    )


@router.get("/modules/{company_id}", response_model=LicenseModulesResponse)
async def get_available_modules(
    company_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Get available modules for a company
    
    Returns the list of modules available in the company's license.
    """
    
    # Find company
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    if company.status != "active":
        raise HTTPException(status_code=403, detail=f"Company is {company.status}")
    
    # Find any active license
    license = db.query(License).filter(
        License.company_id == company_id,
        License.status == "active"
    ).first()
    
    if not license:
        raise HTTPException(status_code=404, detail="No active license found")
    
    # Check expiration
    if license.expires_at < datetime.utcnow():
        license.status = "expired"
        db.commit()
        raise HTTPException(status_code=403, detail="License has expired")
    
    return LicenseModulesResponse(
        modules=license.modules,
        expires_at=license.expires_at
    )
