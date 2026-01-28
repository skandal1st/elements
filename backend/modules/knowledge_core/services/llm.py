import logging
import time

import httpx

from backend.core.config import settings


logger = logging.getLogger(__name__)


NORMALIZATION_SYSTEM_PROMPT = """Ты помощник для нормализации текста статей базы знаний IT-отдела.

Требования:
- Строго структурируй текст по разделам.
- НЕ добавляй новые факты и НЕ выдумывай.
- НЕ меняй смысл исходного текста.
- Если данных для раздела нет — оставь раздел пустым (после двоеточия ничего).

Формат ответа (ровно эти поля и порядок):
Problem:
Symptoms:
Environment:
Root cause:
Solution steps:
Verification:
Notes:
"""


async def chat_completion(
    *,
    api_key: str,
    base_url: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.2,
) -> tuple[str, dict]:
    """
    Универсальный вызов OpenRouter /chat/completions.
    Возвращает (content, meta:{model,duration_ms}).
    """
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY не задан")
    if not model or not str(model).strip():
        raise RuntimeError("OPENROUTER_MODEL не задан")
    model_l = str(model).strip().lower()
    if "embedding" in model_l or model_l.startswith("text-embedding"):
        raise RuntimeError(
            "Выбрана embedding-модель, но требуется chat-модель для /chat/completions"
        )

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": float(temperature),
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    t0 = time.time()
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{(base_url or '').rstrip('/')}/chat/completions",
            json=payload,
            headers=headers,
        )
    dt_ms = int((time.time() - t0) * 1000)

    if resp.status_code >= 400:
        body = resp.text[:2000]
        logger.warning("OpenRouter error %s: %s", resp.status_code, body)
        try:
            j = resp.json()
            msg = (j.get("error") or {}).get("message")
            if msg:
                raise RuntimeError(f"OpenRouter: {msg}")
        except Exception:
            pass
        raise RuntimeError(f"OpenRouter error: {resp.status_code}")

    data = resp.json()
    content = (
        (((data.get("choices") or [{}])[0]).get("message") or {}).get("content") or ""
    )
    return content.strip(), {"model": model, "duration_ms": dt_ms}


async def normalize_article_text(
    raw_content: str,
    *,
    enabled: bool,
    api_key: str,
    base_url: str,
    model: str,
) -> tuple[str, dict]:
    """
    Возвращает (normalized_content, meta).
    meta содержит model, duration_ms.
    """
    if not enabled:
        raise RuntimeError("LLM_NORMALIZATION_ENABLED отключен")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY не задан")
    if not model or not str(model).strip():
        raise RuntimeError("OPENROUTER_MODEL не задан")

    # Для нормализации (Этап 1) используется chat/completions.
    # Embedding-модели сюда НЕ подходят.
    model_l = str(model).strip().lower()
    if "embedding" in model_l or model_l.startswith("text-embedding"):
        raise RuntimeError(
            "Выбрана embedding-модель, но для нормализации нужен chat-модель. "
            "Укажите, например: openai/gpt-4o-mini"
        )

    user_prompt = (
        "Нормализуй следующий текст статьи, сохранив смысл. Текст:\n\n"
        + (raw_content or "").strip()
    )

    return await chat_completion(
        api_key=api_key,
        base_url=base_url,
        model=model,
        system_prompt=NORMALIZATION_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        temperature=0.0,
    )

