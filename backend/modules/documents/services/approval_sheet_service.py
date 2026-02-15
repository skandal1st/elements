"""Генерация PDF-листа согласования."""

import os
import uuid
from datetime import datetime
from io import BytesIO
from pathlib import Path

from sqlalchemy.orm import Session

from backend.modules.documents.models import ApprovalInstance, Document
from backend.modules.hr.models.user import User

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads/tickets")).parent / "documents"


def generate_approval_sheet_pdf(
    db: Session,
    document: Document,
    instance: ApprovalInstance,
) -> str:
    """Генерирует PDF-лист согласования и возвращает путь к файлу."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import (
        SimpleDocTemplate,
        Table,
        TableStyle,
        Paragraph,
        Spacer,
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    # Регистрируем шрифт с поддержкой кириллицы (fallback на Helvetica)
    try:
        font_path = os.path.join(os.path.dirname(__file__), "DejaVuSans.ttf")
        if not os.path.exists(font_path):
            # Попробуем системный шрифт
            for candidate in [
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "C:/Windows/Fonts/arial.ttf",
                "/usr/share/fonts/TTF/DejaVuSans.ttf",
            ]:
                if os.path.exists(candidate):
                    font_path = candidate
                    break
        if os.path.exists(font_path):
            pdfmetrics.registerFont(TTFont("CyrFont", font_path))
            font_name = "CyrFont"
        else:
            font_name = "Helvetica"
    except Exception:
        font_name = "Helvetica"

    dest_dir = UPLOAD_DIR / "sheets"
    dest_dir.mkdir(parents=True, exist_ok=True)
    filename = f"approval_sheet_{uuid.uuid4().hex}.pdf"
    filepath = dest_dir / filename

    doc_pdf = SimpleDocTemplate(
        str(filepath),
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "TitleCyr",
        parent=styles["Title"],
        fontName=font_name,
        fontSize=14,
    )
    normal_style = ParagraphStyle(
        "NormalCyr",
        parent=styles["Normal"],
        fontName=font_name,
        fontSize=10,
    )

    elements = []

    # Заголовок
    elements.append(Paragraph("ЛИСТ СОГЛАСОВАНИЯ", title_style))
    elements.append(Spacer(1, 10 * mm))

    # Информация о документе
    creator = db.query(User).filter(User.id == document.creator_id).first()
    creator_name = creator.full_name if creator else "—"
    doc_type_name = document.document_type.name if document.document_type else "—"

    info_data = [
        ["Документ:", document.title],
        ["Тип:", doc_type_name],
        ["Инициатор:", creator_name],
        ["Дата создания:", document.created_at.strftime("%d.%m.%Y %H:%M") if document.created_at else "—"],
        ["Статус:", _translate_status(document.status)],
        ["Попытка:", str(instance.attempt)],
    ]
    info_table = Table(info_data, colWidths=[40 * mm, 120 * mm])
    info_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), font_name),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("FONTNAME", (0, 0), (0, -1), font_name),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 10 * mm))

    # Таблица согласования
    header = ["#", "ФИО согласующего", "Решение", "Комментарий", "Дата/Время"]
    table_data = [header]

    for idx, step in enumerate(instance.step_instances, 1):
        approver = db.query(User).filter(User.id == step.approver_id).first()
        approver_name = approver.full_name if approver else "—"
        decision = _translate_decision(step.status)
        comment = step.comment or ""
        decision_time = step.decision_at.strftime("%d.%m.%Y %H:%M") if step.decision_at else "—"

        if step.carry_over:
            decision += " (перенос)"

        table_data.append([
            str(idx),
            approver_name,
            decision,
            comment[:80],
            decision_time,
        ])

    col_widths = [10 * mm, 45 * mm, 30 * mm, 55 * mm, 30 * mm]
    approval_table = Table(table_data, colWidths=col_widths)
    approval_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), font_name),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e5e7eb")),
        ("FONTNAME", (0, 0), (-1, 0), font_name),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(approval_table)

    doc_pdf.build(elements)
    return f"/uploads/documents/sheets/{filename}"


def _translate_status(status: str) -> str:
    mapping = {
        "draft": "Черновик",
        "pending_approval": "На согласовании",
        "approved": "Согласован",
        "rejected": "Отклонён",
        "cancelled": "Отменён",
    }
    return mapping.get(status, status)


def _translate_decision(status: str) -> str:
    mapping = {
        "pending": "Ожидание",
        "approved": "Согласовано",
        "rejected": "Отклонено",
        "skipped": "Пропущено",
    }
    return mapping.get(status, status)
