#!/usr/bin/env python3
"""
Миграция данных из старого PHP-модуля docs (MySQL) в модуль Договора Elements (PostgreSQL).

Требуется:
  - MySQL: MYSQL_DOCS_HOST, MYSQL_DOCS_USER, MYSQL_DOCS_PASSWORD, MYSQL_DOCS_DATABASE (по умолчанию docs_circ)
  - PostgreSQL: DATABASE_URL из .env (как обычно для backend)
  - Опционально: DOCS_FILES_ROOT — путь к каталогу html/docs (base/, actbase/, firmbase/) для копирования файлов

Запуск из корня проекта:
  python -m backend.scripts.migrate_docs_to_contracts
  или с указанием .env:
  python -m backend.scripts.migrate_docs_to_contracts --env .env
"""
from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path
from decimal import Decimal
from datetime import date, datetime

# Добавляем корень проекта в path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

try:
    import pymysql
except ImportError:
    print("Установите pymysql: pip install pymysql")
    sys.exit(1)

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from backend.core.config import settings
from backend.modules.contracts.models import (
    Counterparty,
    ContractType,
    Funding,
    CostCode,
    Subunit,
    Contract,
    ContractAct,
    ContractFile,
)


def parse_date(v) -> date | None:
    if v is None or v == "0000-00-00" or v == "0001-01-01":
        return None
    if isinstance(v, date):
        return v
    if isinstance(v, datetime):
        return v.date()
    try:
        return datetime.strptime(str(v)[:10], "%Y-%m-%d").date()
    except Exception:
        return None


def dec(v) -> Decimal:
    if v is None:
        return Decimal("0")
    try:
        return Decimal(str(v))
    except Exception:
        return Decimal("0")


def main() -> None:
    mysql_host = os.getenv("MYSQL_DOCS_HOST", "127.0.0.1")
    mysql_user = os.getenv("MYSQL_DOCS_USER", "Jonny")
    mysql_password = os.getenv("MYSQL_DOCS_PASSWORD", "John-Pon-21356")
    mysql_db = os.getenv("MYSQL_DOCS_DATABASE", "docs_circ")
    docs_files_root = os.getenv("DOCS_FILES_ROOT", "")

    print("Подключение к MySQL...")
    try:
        conn_mysql = pymysql.connect(
            host=mysql_host,
            user=mysql_user,
            password=mysql_password,
            database=mysql_db,
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor,
        )
    except Exception as e:
        print(f"Ошибка подключения к MySQL: {e}")
        sys.exit(1)

    print("Подключение к PostgreSQL...")
    engine = create_engine(settings.database_url)
    Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    db = Session()

    # 1. Справочники
    firm_num_to_id: dict[int, str] = {}
    with conn_mysql.cursor() as cur:
        cur.execute("SELECT num, name, fullname, INN FROM firms ORDER BY num")
        for row in cur.fetchall():
            c = Counterparty(
                legacy_num=row["num"],
                name=(row["name"] or "").strip() or "—",
                full_name=(row.get("fullname") or "").strip() or None,
                inn=(row.get("INN") or "").strip() or None,
                is_active=True,
            )
            db.add(c)
            db.flush()
            firm_num_to_id[row["num"]] = str(c.id)
    db.commit()
    print(f"  Контрагенты: {len(firm_num_to_id)}")

    type_num_to_id: dict[int, str] = {}
    with conn_mysql.cursor() as cur:
        cur.execute("SELECT num, name FROM dogtypes ORDER BY num")
        for row in cur.fetchall():
            t = ContractType(
                legacy_num=row["num"],
                name=(row["name"] or "").strip() or "—",
                is_active=True,
            )
            db.add(t)
            db.flush()
            type_num_to_id[row["num"]] = str(t.id)
    db.commit()
    print(f"  Типы договоров: {len(type_num_to_id)}")

    funding_num_to_id: dict[int, str] = {}
    with conn_mysql.cursor() as cur:
        cur.execute("SELECT num, name FROM funding ORDER BY num")
        for row in cur.fetchall():
            f = Funding(
                legacy_num=row["num"],
                name=(row["name"] or "").strip() or "—",
                is_active=True,
            )
            db.add(f)
            db.flush()
            funding_num_to_id[row["num"]] = str(f.id)
    db.commit()
    print(f"  Источники финансирования: {len(funding_num_to_id)}")

    shifr_num_to_id: dict[int, str] = {}
    with conn_mysql.cursor() as cur:
        cur.execute("SELECT num, name FROM shifrs ORDER BY num")
        for row in cur.fetchall():
            s = CostCode(
                legacy_num=row["num"],
                name=(row["name"] or "").strip() or "—",
                is_active=True,
            )
            db.add(s)
            db.flush()
            shifr_num_to_id[row["num"]] = str(s.id)
    db.commit()
    print(f"  Шифры затрат: {len(shifr_num_to_id)}")

    subunit_id_to_uuid: dict[int, str] = {}
    with conn_mysql.cursor() as cur:
        cur.execute("SELECT idsubunits, subunitsname FROM subunits ORDER BY idsubunits")
        for row in cur.fetchall():
            s = Subunit(
                legacy_id=row["idsubunits"],
                name=(row["subunitsname"] or "").strip() or "—",
                is_active=True,
            )
            db.add(s)
            db.flush()
            subunit_id_to_uuid[row["idsubunits"]] = str(s.id)
    db.commit()
    print(f"  Подразделения: {len(subunit_id_to_uuid)}")

    # 2. Договора
    dog_num_to_id: dict[int, str] = {}
    with conn_mysql.cursor() as cur:
        cur.execute("""
            SELECT num, dogtypeNum, firmNum, fundnum, shifrNum, subunitsid,
                   number, datebegin, dateend, name, fullname, invnum, comment,
                   sum, notice, term, done
            FROM dogs ORDER BY num
        """)
        for row in cur.fetchall():
            contract = Contract(
                legacy_num=row["num"],
                contract_type_id=type_num_to_id.get(row["dogtypeNum"]) if row.get("dogtypeNum") else None,
                counterparty_id=firm_num_to_id.get(row["firmNum"]) if row.get("firmNum") else None,
                funding_id=funding_num_to_id.get(row["fundnum"]) if row.get("fundnum") else None,
                cost_code_id=shifr_num_to_id.get(row["shifrNum"]) if row.get("shifrNum") else None,
                subunit_id=subunit_id_to_uuid.get(row["subunitsid"]) if row.get("subunitsid") else None,
                number=(row["number"] or "").strip() or "—",
                date_begin=parse_date(row.get("datebegin")),
                date_end=parse_date(row.get("dateend")),
                name=(row["name"] or "").strip() or "—",
                full_name=(row.get("fullname") or "").strip() or None,
                inv_num=(row.get("invnum") or "").strip() or None,
                comment=(row.get("comment") or "").strip() or None,
                sum_amount=dec(row.get("sum")),
                notice=(row.get("notice") or "").strip() or None,
                term=parse_date(row.get("term")),
                done=bool(row.get("done")),
            )
            db.add(contract)
            db.flush()
            dog_num_to_id[row["num"]] = str(contract.id)
    db.commit()
    print(f"  Договора: {len(dog_num_to_id)}")

    # 3. Акты
    with conn_mysql.cursor() as cur:
        cur.execute("SELECT num, dogNum, doctype, number, date, notice, aktsum FROM acts ORDER BY dogNum, date")
        count = 0
        for row in cur.fetchall():
            contract_id = dog_num_to_id.get(row["dogNum"]) if row.get("dogNum") else None
            if not contract_id:
                continue
            act = ContractAct(
                legacy_num=row["num"],
                contract_id=contract_id,
                doctype=int(row["doctype"]) if row.get("doctype") is not None else 0,
                number=(row.get("number") or "").strip() or None,
                act_date=parse_date(row.get("date")),
                notice=(row.get("notice") or "").strip() or None,
                amount=dec(row.get("aktsum")),
            )
            db.add(act)
            count += 1
        db.commit()
    print(f"  Акты: {count}")

    # 4. Файлы (src, actsrc, firmsrc) — только если задан DOCS_FILES_ROOT
    if docs_files_root:
        root = Path(docs_files_root)
        base_dir = root / "base"
        actbase_dir = root / "actbase"
        firmbase_dir = root / "firmbase"
        uploads_contracts = Path(os.getenv("UPLOAD_DIR", "uploads/tickets")).parent / "documents" / "contracts"
        uploads_contracts.mkdir(parents=True, exist_ok=True)
        (uploads_contracts / "contracts").mkdir(exist_ok=True)
        (uploads_contracts / "acts").mkdir(exist_ok=True)
        (uploads_contracts / "counterparties").mkdir(exist_ok=True)

        with conn_mysql.cursor() as cur:
            cur.execute("SELECT dogNum, num FROM src")
            for row in cur.fetchall():
                contract_id = dog_num_to_id.get(row["dogNum"]) if row.get("dogNum") else None
                if not contract_id:
                    continue
                src_file = base_dir / f"actsrc{row['num']}.pdf"
                if src_file.exists():
                    dest = uploads_contracts / "contracts" / f"{contract_id}_{row['num']}.pdf"
                    shutil.copy2(src_file, dest)
                    rel = f"/uploads/documents/contracts/contracts/{dest.name}"
                    cf = ContractFile(contract_id=contract_id, kind="contract", file_path=rel, file_name=dest.name)
                    db.add(cf)
        db.commit()
        print("  Файлы договоров (src): скопированы")

        act_num_to_id: dict[int, str] = {}
        for a in db.query(ContractAct).all():
            if a.legacy_num is not None:
                act_num_to_id[a.legacy_num] = str(a.id)
        with conn_mysql.cursor() as cur:
            cur.execute("SELECT actnum, num FROM actsrc")
            for row in cur.fetchall():
                act_id = act_num_to_id.get(row["actnum"]) if row.get("actnum") is not None else None
                if not act_id:
                    continue
                src_file = actbase_dir / f"actsrc{row['num']}.pdf"
                if src_file.exists():
                    dest = uploads_contracts / "acts" / f"{act_id}_{row['num']}.pdf"
                    shutil.copy2(src_file, dest)
                    rel = f"/uploads/documents/contracts/acts/{dest.name}"
                    cf = ContractFile(contract_act_id=act_id, kind="act", file_path=rel, file_name=dest.name)
                    db.add(cf)
        db.commit()
        print("  Файлы актов (actsrc): скопированы")
    else:
        print("  DOCS_FILES_ROOT не задан — копирование файлов пропущено")

    conn_mysql.close()
    db.close()
    print("Миграция завершена.")


if __name__ == "__main__":
    main()
