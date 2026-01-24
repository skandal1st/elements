import re

# Таблица транслитерации кириллицы в латиницу
TRANSLIT_TABLE = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'E',
    'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
    'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
    'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch',
    'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
}


def transliterate(text: str) -> str:
    """Транслитерация кириллицы в латиницу"""
    result = []
    for char in text:
        result.append(TRANSLIT_TABLE.get(char, char))
    return ''.join(result)


def generate_corporate_email(full_name: str, domain: str = "teplocentral.org") -> str:
    """
    Генерирует корпоративный email из ФИО.
    Пример: "Петров Пётр Петрович" -> "p.p.petrov@teplocentral.org"
    """
    parts = [part for part in re.split(r"\s+", full_name.strip()) if part]
    
    if len(parts) >= 3:
        # Фамилия Имя Отчество -> i.o.familiya
        last, first, middle = parts[0], parts[1], parts[2]
        local = f"{transliterate(first[0])}.{transliterate(middle[0])}.{transliterate(last)}"
    elif len(parts) == 2:
        # Фамилия Имя -> i.familiya
        last, first = parts[0], parts[1]
        local = f"{transliterate(first[0])}.{transliterate(last)}"
    elif parts:
        local = transliterate(parts[0])
    else:
        local = "user"
    
    return f"{local.lower()}@{domain}"
