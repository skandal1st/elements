from datetime import date

from sqlalchemy.orm import Session

from app.models.department import Department
from app.models.employee import Employee
from app.models.hr_request import HRRequest
from app.models.it_account import ITAccount
from app.models.position import Position
from app.services.integrations import (
    ad_create_user,
    ad_disable_user,
    block_it_accounts,
    create_supporit_ticket,
    fetch_equipment_for_employee,
    mailcow_create_mailbox,
    mailcow_disable_mailbox,
    provision_it_accounts,
)
from app.services.notifications import send_email, send_internal_notification
from app.utils.naming import generate_corporate_email


def process_hr_request(db: Session, request: HRRequest) -> HRRequest:
    employee = db.query(Employee).filter(Employee.id == request.employee_id).first()
    if not employee:
        raise ValueError("Сотрудник не найден")

    # Получаем название отдела и должности
    department_name = None
    position_name = None
    if employee.department_id:
        dept = db.query(Department).filter(Department.id == employee.department_id).first()
        if dept:
            department_name = dept.name
    if employee.position_id:
        pos = db.query(Position).filter(Position.id == employee.position_id).first()
        if pos:
            position_name = pos.name

    if request.type == "hire":
        # Получаем номер пропуска из заявки или сотрудника
        pass_number = request.pass_number or employee.pass_number

        if request.needs_it_equipment:
            # Создаем ИТ-учетки
            accounts = provision_it_accounts(employee.full_name)
            corporate_email = generate_corporate_email(employee.full_name)
            if not employee.email:
                employee.email = corporate_email
            ad_account = (
                ad_create_user(employee.email, employee.full_name)
                or accounts.ad_account
            )
            mailcow_created = mailcow_create_mailbox(employee.email, employee.full_name)
            it_account = ITAccount(
                employee_id=employee.id,
                ad_account=ad_account,
                mailcow_account=employee.email
                if mailcow_created
                else accounts.mailcow_account,
                messenger_account=accounts.messenger_account,
            )
            db.add(it_account)

            send_email(
                employee.email or "hr@company.local",
                "Инструкции ИБ и доступы",
                "Аккаунты созданы, ознакомьтесь с инструкцией.",
            )
            send_internal_notification(f"Созданы ИТ-учетки для {employee.full_name}")

            # Создаем тикет с ИТ-задачами И пропуском СКУД
            ticket_description = (
                f"ФИО: {employee.full_name}\n"
                f"Email: {employee.email}\n"
                f"Отдел: {department_name or 'Не указан'}\n"
                f"Должность: {position_name or 'Не указана'}\n"
                f"Дата выхода: {request.effective_date}"
            )
            if pass_number:
                ticket_description += (
                    f"\n\nДобавить пропуск в систему СКУД:\n"
                    f"Данные пропуска: {pass_number}"
                )
            create_supporit_ticket(
                title=f"Онбординг: {employee.full_name}",
                description=ticket_description,
                category="hr",
            )
        else:
            # Сотрудник НЕ использует ИТ - создаем отдельный тикет только для СКУД
            if pass_number:
                create_supporit_ticket(
                    title=f"Добавить пропуск в СКУД: {employee.full_name}",
                    description=(
                        f"ФИО: {employee.full_name}\n"
                        f"Отдел: {department_name or 'Не указан'}\n"
                        f"Должность: {position_name or 'Не указана'}\n"
                        f"Дата выхода: {request.effective_date}\n\n"
                        f"Добавить пропуск в систему СКУД:\n"
                        f"Данные пропуска: {pass_number}"
                    ),
                    category="hr",
                )

        employee.status = "active"
        request.status = "done"
    elif request.type == "fire":
        employee.status = "dismissed"
        request.status = "done"

        accounts = (
            db.query(ITAccount).filter(ITAccount.employee_id == employee.id).all()
        )
        block_it_accounts([acc.ad_account for acc in accounts if acc.ad_account])
        for account in accounts:
            if account.ad_account:
                ad_disable_user(account.ad_account)
        if employee.email:
            mailcow_disable_mailbox(employee.email)
        for account in accounts:
            account.status = "blocked"

        equipment = fetch_equipment_for_employee(employee.id, employee.email)
        
        # Создаем заявку на сбор оборудования
        equipment_lines = "\n".join(
            f"- {item.get('name') or item.get('type')} ({item.get('inventory_number') or item.get('serial_number')})"
            for item in equipment
        ) if equipment else "Нет данных"
        
        create_supporit_ticket(
            title=f"Увольнение: сбор оборудования - {employee.full_name}",
            description=(
                f"ФИО: {employee.full_name}\n"
                f"Email: {employee.email}\n"
                f"Отдел: {department_name or 'Не указан'}\n"
                f"Должность: {position_name or 'Не указана'}\n"
                f"Дата увольнения: {request.effective_date}\n\n"
                f"Оборудование к сдаче:\n{equipment_lines}\n\n"
                f"Задачи:\n"
                f"- Собрать оборудование\n"
                f"- Заблокировать учётные записи\n"
                f"- Удалить пропуск из СКУД"
            ),
            category="hr",
        )
        
        if equipment:
            send_internal_notification(
                f"Оборудование не сдано: {employee.full_name}",
            )
            send_email(
                "it@company.local",
                "Не сдано оборудование",
                f"У сотрудника {employee.full_name} осталось оборудование.",
            )
    else:
        raise ValueError("Неизвестный тип заявки")

    if request.request_date is None:
        request.request_date = date.today()

    db.commit()
    db.refresh(request)
    return request
