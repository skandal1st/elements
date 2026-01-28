import logging
import time

import httpx


logger = logging.getLogger(__name__)


async def create_embedding(
    text: str,
    *,
    api_key: str,
    base_url: str,
    model: str,
) -> tuple[list[float], dict]:
    """
    Создаёт embedding через OpenRouter /embeddings.

    Возвращает (vector, meta) где meta содержит model, duration_ms.
    """
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY не задан")
    if not model or not str(model).strip():
        raise RuntimeError("OPENROUTER_EMBEDDING_MODEL не задан")

    model_l = str(model).strip().lower()
    # Защита от чат-моделей: embeddings endpoint ожидает embedding модель.
    if "embedding" not in model_l and not model_l.startswith("text-embedding"):
        logger.warning("Suspicious embedding model: %s", model)

    payload = {
        "model": model,
        "input": (text or "").strip(),
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    t0 = time.time()
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{(base_url or '').rstrip('/')}/embeddings",
            json=payload,
            headers=headers,
        )
    dt_ms = int((time.time() - t0) * 1000)

    if resp.status_code >= 400:
        body = resp.text[:2000]
        logger.warning("OpenRouter embeddings error %s: %s", resp.status_code, body)
        try:
            j = resp.json()
            msg = (j.get("error") or {}).get("message")
            if msg:
                raise RuntimeError(f"OpenRouter embeddings: {msg}")
        except Exception:
            pass
        raise RuntimeError(f"OpenRouter embeddings error: {resp.status_code}")

    data = resp.json()
    arr = (data.get("data") or [])
    if not arr or not isinstance(arr, list) or "embedding" not in arr[0]:
        raise RuntimeError("Неожиданный ответ OpenRouter /embeddings")
    vec = arr[0]["embedding"]
    if not isinstance(vec, list) or not vec:
        raise RuntimeError("Embedding пустой")
    return [float(x) for x in vec], {"model": model, "duration_ms": dt_ms, "dim": len(vec)}

