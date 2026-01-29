"""
Сканирование ПК в домене через WinRM-шлюз (Windows).
Использует учётную запись AD из интеграции (ldap_bind_dn / ldap_bind_password).
"""

import base64
import json
import re
from typing import Any, Optional

from sqlalchemy.orm import Session

from backend.modules.hr.models.system_settings import SystemSettings


def _get_setting_raw(db: Session, key: str) -> Optional[str]:
    s = db.query(SystemSettings).filter(SystemSettings.setting_key == key).first()
    return s.setting_value if s else None


def get_scan_config(db: Session) -> dict:
    """Читает настройки шлюза и AD для сканирования (пароль без маски)."""
    host = (_get_setting_raw(db, "scan_gateway_host") or "").strip()
    port_raw = _get_setting_raw(db, "scan_gateway_port")
    try:
        port = int(port_raw) if port_raw else 5985
    except (TypeError, ValueError):
        port = 5985
    use_ssl = (_get_setting_raw(db, "scan_gateway_use_ssl") or "false").lower() == "true"
    # WinRM принимает DOMAIN\user или user@domain.local; LDAP DN (CN=...,OU=...) шлюз часто отклоняет
    gateway_user = (_get_setting_raw(db, "scan_gateway_username") or "").strip()
    ldap_dn = (_get_setting_raw(db, "ldap_bind_dn") or "").strip()
    user = gateway_user if gateway_user else ldap_dn
    password = _get_setting_raw(db, "ldap_bind_password") or ""
    return {
        "gateway_host": host,
        "gateway_port": port,
        "gateway_use_ssl": use_ssl,
        "username": user,
        "password": password,
    }


def run_scan(
    computer_name_or_ip: str,
    gateway_host: str,
    gateway_port: int,
    gateway_use_ssl: bool,
    username: str,
    password: str,
) -> dict[str, Any]:
    """
    Запускает сканирование ПК через WinRM-шлюз.
    Шлюз — Windows в домене с включённым WinRM; учётка AD для подключения к шлюзу и к целевому ПК.
    Возвращает dict с полями: computer_name, ip_address, serial_number, manufacturer, model, os, cpu, ram, storage, disks.
    """
    try:
        import winrm
    except ImportError as e:
        raise RuntimeError(
            "Модуль pywinrm не установлен. Установите: pip install pywinrm"
        ) from e

    target = (computer_name_or_ip or "").strip()
    if not target:
        raise ValueError("Укажите имя или IP компьютера")

    if not gateway_host:
        raise ValueError("Не настроен scan_gateway_host (Windows-шлюз с WinRM)")

    scheme = "https" if gateway_use_ssl else "http"
    endpoint = f"{scheme}://{gateway_host}:{gateway_port}/wsman"

    # Передаём target, user и пароль (base64) в скрипт — pywinrm run_ps не поддерживает stdin
    target_esc = target.replace("'", "''").replace("`", "``")
    user_esc = (username or "").replace("'", "''").replace("`", "``")
    pass_b64 = base64.b64encode((password or "").encode("utf-8")).decode("ascii")

    ps_script = f"""
$ErrorActionPreference = 'Stop'
$target = '{target_esc}'
$user = '{user_esc}'
$passB64 = '{pass_b64}'
$pass = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($passB64))
$sec = ConvertTo-SecureString $pass -AsPlainText -Force
$cred = New-Object PSCredential($user, $sec)
$sb = {{
    $os = Get-WmiObject Win32_OperatingSystem -ErrorAction Stop
    $cs = Get-WmiObject Win32_ComputerSystem -ErrorAction Stop
    $bios = Get-WmiObject Win32_BIOS -ErrorAction Stop
    $cpu = Get-WmiObject Win32_Processor -ErrorAction Stop | Select-Object -First 1
    $ram = Get-WmiObject Win32_PhysicalMemory -ErrorAction Stop
    $totalRAM = ($ram | Measure-Object Capacity -Sum).Sum / 1GB
    $disks = Get-WmiObject Win32_LogicalDisk -Filter "DriveType=3" -ErrorAction Stop
    $diskLines = @()
    foreach ($d in $disks) {{
        $size = [math]::Round($d.Size / 1GB, 2)
        $free = [math]::Round($d.FreeSpace / 1GB, 2)
        $diskLines += "$($d.DeviceID) - ${{size}} GB (свободно ${{free}} GB)"
    }}
    $firstIP = $null
    try {{
        $adapters = Get-WmiObject Win32_NetworkAdapterConfiguration -Filter "IPEnabled=True" -ErrorAction Stop
        if ($adapters -and $adapters.IPAddress) {{ $firstIP = $adapters.IPAddress[0] }}
    }} catch {{}}
    [PSCustomObject]@{{
        Computer = $cs.Name
        Manufacturer = $cs.Manufacturer
        Model = $cs.Model
        SerialNumber = $bios.SerialNumber
        OS = $os.Caption
        CPU = $cpu.Name.Trim()
        RAM_GB = [math]::Round($totalRAM, 2)
        Storage = ($diskLines -join "; ")
        Disks = ($diskLines -join "`n")
        FirstIP = $firstIP
    }}
}}
$r = Invoke-Command -ComputerName $target -Credential $cred -ScriptBlock $sb -ErrorAction Stop
if ($r) {{ $r | ConvertTo-Json -Compress }} else {{ "{{}}" }}
"""

    try:
        session = winrm.Session(
            endpoint,
            auth=(username, password),
            transport="ntlm" if not gateway_use_ssl else "kerberos",
            server_cert_validation="ignore" if gateway_use_ssl else "validate",
        )
        r = session.run_ps(ps_script)
        if r.status_code != 0:
            err = r.std_err.decode("utf-8", errors="replace") if r.std_err else ""
            raise RuntimeError(f"Ошибка на шлюзе (код {r.status_code}): {err}")

        out = (r.std_out or b"").decode("utf-8", errors="replace").strip()
        # Убрать возможный BOM и лишний вывод
        if out.startswith("\ufeff"):
            out = out[1:]
        # PowerShell может вывести что-то до/после JSON
        json_match = re.search(r"\{[\s\S]*\}", out)
        if not json_match:
            raise ValueError(f"Шлюз не вернул JSON. Вывод: {out[:500]}")
        data = json.loads(json_match.group())
    except json.JSONDecodeError as e:
        raise ValueError(f"Некорректный ответ от шлюза (не JSON): {e}") from e
    except Exception as e:
        err_msg = str(e).strip().lower()
        if "credentials were rejected" in err_msg or "rejected by the server" in err_msg:
            raise RuntimeError(
                "Учётные данные отклонены шлюзом. Укажите в настройках «Пользователь для шлюза (WinRM)» "
                "в формате DOMAIN\\user или user@domain.local (пароль — тот же, что Bind Password)."
            ) from e
        if "winrm" in err_msg or "connection" in err_msg:
            raise RuntimeError(
                "Не удалось подключиться к Windows-шлюзу. Проверьте хост, порт и учётку."
            ) from e
        raise RuntimeError(f"Ошибка сканирования через шлюз: {e}") from e

    # Нормализуем под EquipmentSyncFromScan
    return {
        "computer_name": data.get("Computer") or target,
        "ip_address": data.get("FirstIP"),
        "serial_number": data.get("SerialNumber"),
        "manufacturer": data.get("Manufacturer"),
        "model": data.get("Model"),
        "os": data.get("OS"),
        "cpu": data.get("CPU"),
        "ram": f"{data.get('RAM_GB', 0)} GB" if data.get("RAM_GB") is not None else None,
        "storage": data.get("Storage"),
        "disks": data.get("Disks"),
    }
