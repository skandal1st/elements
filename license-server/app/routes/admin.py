"""
Admin routes for License Server
CRUD operations for companies and licenses
"""

import logging
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Company, License
from ..schemas.company import CompanyCreate, CompanyResponse, CompanyUpdate
from ..schemas.license import LicenseCreate, LicenseResponse, LicenseUpdate
from ..services.license_generator import generate_license_key
from ..config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


def verify_admin_key(x_api_key: str = Header(...)):
    """Verify admin API key"""
    if settings.admin_api_key and x_api_key != settings.admin_api_key:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return True


# ============================================================================
# COMPANIES
# ============================================================================

@router.post("/companies", response_model=CompanyResponse)
async def create_company(
    data: CompanyCreate,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """Create a new company"""

    # Check if company with this email already exists
    existing = db.query(Company).filter(Company.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Company with this email already exists")

    company = Company(
        name=data.name,
        email=data.email,
        contact_name=data.contact_name,
        contact_email=data.contact_email,
    )

    db.add(company)
    db.commit()
    db.refresh(company)

    logger.info(f"Created company: {company.name} ({company.id})")

    return company


@router.get("/companies", response_model=List[CompanyResponse])
async def list_companies(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """List all companies"""
    companies = db.query(Company).offset(skip).limit(limit).all()
    return companies


@router.get("/companies/{company_id}", response_model=CompanyResponse)
async def get_company(
    company_id: UUID,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """Get company by ID"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.patch("/companies/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: UUID,
    data: CompanyUpdate,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """Update company"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(company, field, value)

    db.commit()
    db.refresh(company)

    logger.info(f"Updated company: {company.name} ({company.id})")

    return company


@router.delete("/companies/{company_id}")
async def delete_company(
    company_id: UUID,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """Delete company and all its licenses"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    company_name = company.name
    db.delete(company)
    db.commit()

    logger.warning(f"Deleted company: {company_name} ({company_id})")

    return {"message": f"Company {company_name} deleted"}


# ============================================================================
# LICENSES
# ============================================================================

@router.post("/licenses", response_model=LicenseResponse)
async def create_license(
    data: LicenseCreate,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """Create a new license"""

    # Verify company exists
    company = db.query(Company).filter(Company.id == data.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Generate license key
    license_key = generate_license_key(data.edition, str(data.company_id))

    # Create license
    license = License(
        company_id=data.company_id,
        license_key=license_key,
        edition=data.edition,
        modules=data.modules,
        features=data.features,
        max_users=data.max_users,
        max_instances=data.max_instances,
        expires_at=data.expires_at,
        bind_hardware=data.bind_hardware,
        allowed_hardware_ids=data.allowed_hardware_ids,
    )

    db.add(license)
    db.commit()
    db.refresh(license)

    logger.info(
        f"Created {data.edition} license for company {company.name}: "
        f"{license_key}, expires {data.expires_at}"
    )

    return license


@router.get("/licenses", response_model=List[LicenseResponse])
async def list_licenses(
    company_id: UUID = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """List all licenses, optionally filtered by company"""
    query = db.query(License)

    if company_id:
        query = query.filter(License.company_id == company_id)

    licenses = query.offset(skip).limit(limit).all()
    return licenses


@router.get("/licenses/{license_id}", response_model=LicenseResponse)
async def get_license(
    license_id: UUID,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """Get license by ID"""
    license = db.query(License).filter(License.id == license_id).first()
    if not license:
        raise HTTPException(status_code=404, detail="License not found")
    return license


@router.patch("/licenses/{license_id}", response_model=LicenseResponse)
async def update_license(
    license_id: UUID,
    data: LicenseUpdate,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """Update license"""
    license = db.query(License).filter(License.id == license_id).first()
    if not license:
        raise HTTPException(status_code=404, detail="License not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(license, field, value)

    db.commit()
    db.refresh(license)

    logger.info(f"Updated license {license.license_key}")

    return license


@router.patch("/licenses/{license_id}/revoke")
async def revoke_license(
    license_id: UUID,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """Revoke a license"""
    license = db.query(License).filter(License.id == license_id).first()
    if not license:
        raise HTTPException(status_code=404, detail="License not found")

    license.status = "revoked"
    db.commit()

    logger.warning(f"Revoked license {license.license_key}")

    return {"message": f"License {license.license_key} revoked"}


@router.patch("/licenses/{license_id}/activate")
async def activate_license(
    license_id: UUID,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """Activate a revoked license"""
    license = db.query(License).filter(License.id == license_id).first()
    if not license:
        raise HTTPException(status_code=404, detail="License not found")

    license.status = "active"
    db.commit()

    logger.info(f"Activated license {license.license_key}")

    return {"message": f"License {license.license_key} activated"}
