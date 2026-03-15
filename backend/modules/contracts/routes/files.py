"""Загрузка и удаление файлов договоров и актов (PDF, DOC, DOCX)."""
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from backend.modules.contracts.dependencies import (
    get_db,
    get_current_user,
    require_contracts_roles,
)
from backend.modules.contracts.models import Contract, ContractAct, ContractFile
from backend.modules.contracts.schemas.file_schema import ContractFileOut
from backend.modules.contracts.services.file_service import save_contract_file
from backend.modules.hr.models.user import User

router = APIRouter(tags=["contracts-files"])


@router.post("/{contract_id}/files", response_model=ContractFileOut, status_code=201)
async def upload_contract_file(
    contract_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_contracts_roles(["admin", "specialist"])),
):
    """Загрузить файл к договору (PDF, DOC, DOCX)."""
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Договор не найден")
    info = await save_contract_file(file, kind="contract")
    cf = ContractFile(
        contract_id=contract_id,
        contract_act_id=None,
        kind="contract",
        file_path=info["file_path"],
        file_name=info["file_name"],
    )
    db.add(cf)
    db.commit()
    db.refresh(cf)
    return cf


@router.post(
    "/{contract_id}/acts/{act_id}/files",
    response_model=ContractFileOut,
    status_code=201,
)
async def upload_act_file(
    contract_id: UUID,
    act_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_contracts_roles(["admin", "specialist"])),
):
    """Загрузить файл к акту/платежу (PDF, DOC, DOCX)."""
    act = (
        db.query(ContractAct)
        .filter(
            ContractAct.id == act_id,
            ContractAct.contract_id == contract_id,
        )
        .first()
    )
    if not act:
        raise HTTPException(status_code=404, detail="Акт не найден")
    info = await save_contract_file(file, kind="act")
    cf = ContractFile(
        contract_id=contract_id,
        contract_act_id=act_id,
        kind="act",
        file_path=info["file_path"],
        file_name=info["file_name"],
    )
    db.add(cf)
    db.commit()
    db.refresh(cf)
    return cf


@router.delete("/{contract_id}/files/{file_id}", status_code=204)
def delete_contract_file(
    contract_id: UUID,
    file_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_contracts_roles(["admin", "specialist"])),
):
    """Удалить файл договора или акта."""
    cf = (
        db.query(ContractFile)
        .filter(
            ContractFile.id == file_id,
            ContractFile.contract_id == contract_id,
        )
        .first()
    )
    if not cf:
        raise HTTPException(status_code=404, detail="Файл не найден")
    db.delete(cf)
    db.commit()
