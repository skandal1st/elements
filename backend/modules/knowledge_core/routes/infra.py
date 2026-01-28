from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.modules.it.dependencies import get_db, require_it_roles
from backend.modules.knowledge_core.models import (
    NetworkDevice,
    PhysicalServer,
    Service as InfraService,
    VirtualServer,
)
from backend.modules.knowledge_core.schemas import (
    NetworkDeviceCreate,
    NetworkDeviceOut,
    PhysicalServerCreate,
    PhysicalServerOut,
    ServiceCreate,
    ServiceOut,
    VirtualServerCreate,
    VirtualServerOut,
)


router = APIRouter(prefix="/infra", tags=["knowledge"])


@router.get(
    "/network-devices",
    response_model=List[NetworkDeviceOut],
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
)
def list_network_devices(db: Session = Depends(get_db)) -> List[NetworkDevice]:
    return db.query(NetworkDevice).order_by(NetworkDevice.name.asc()).all()


@router.post(
    "/network-devices",
    response_model=NetworkDeviceOut,
    status_code=201,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
def create_network_device(
    payload: NetworkDeviceCreate, db: Session = Depends(get_db)
) -> NetworkDevice:
    d = NetworkDevice(**payload.model_dump())
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


@router.get(
    "/physical-servers",
    response_model=List[PhysicalServerOut],
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
)
def list_physical_servers(db: Session = Depends(get_db)) -> List[PhysicalServer]:
    return db.query(PhysicalServer).order_by(PhysicalServer.name.asc()).all()


@router.post(
    "/physical-servers",
    response_model=PhysicalServerOut,
    status_code=201,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
def create_physical_server(
    payload: PhysicalServerCreate, db: Session = Depends(get_db)
) -> PhysicalServer:
    s = PhysicalServer(**payload.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.get(
    "/virtual-servers",
    response_model=List[VirtualServerOut],
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
)
def list_virtual_servers(db: Session = Depends(get_db)) -> List[VirtualServer]:
    return db.query(VirtualServer).order_by(VirtualServer.name.asc()).all()


@router.post(
    "/virtual-servers",
    response_model=VirtualServerOut,
    status_code=201,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
def create_virtual_server(
    payload: VirtualServerCreate, db: Session = Depends(get_db)
) -> VirtualServer:
    v = VirtualServer(**payload.model_dump())
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


@router.get(
    "/services",
    response_model=List[ServiceOut],
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
)
def list_services(db: Session = Depends(get_db)) -> List[InfraService]:
    return db.query(InfraService).order_by(InfraService.name.asc()).all()


@router.post(
    "/services",
    response_model=ServiceOut,
    status_code=201,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
def create_service(payload: ServiceCreate, db: Session = Depends(get_db)) -> InfraService:
    s = InfraService(**payload.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s

