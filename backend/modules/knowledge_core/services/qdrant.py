import logging
from typing import Any, Optional

import httpx


logger = logging.getLogger(__name__)


DEFAULT_DISTANCE = "Cosine"


class QdrantClient:
    def __init__(self, *, url: str, collection: str):
        self.url = (url or "").rstrip("/")
        self.collection = collection
        if not self.url:
            raise RuntimeError("QDRANT_URL не задан")
        if not self.collection:
            raise RuntimeError("QDRANT_COLLECTION не задан")

    async def _request(self, method: str, path: str, json: Any | None = None) -> Any:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.request(method, f"{self.url}{path}", json=json)
        if resp.status_code >= 400:
            logger.warning("Qdrant error %s %s: %s", method, path, resp.text[:2000])
            raise RuntimeError(f"Qdrant error: {resp.status_code}")
        return resp.json()

    async def ensure_collection(self, *, vector_size: int) -> None:
        # Check if exists
        try:
            info = await self._request("GET", f"/collections/{self.collection}")
            cfg = ((info.get("result") or {}).get("config") or {}).get("params") or {}
            vectors = cfg.get("vectors") or {}
            size = vectors.get("size")
            if size and int(size) != int(vector_size):
                raise RuntimeError(
                    f"Qdrant collection '{self.collection}' имеет размер {size}, "
                    f"но embedding размер {vector_size}. Нужна новая collection."
                )
            return
        except RuntimeError as e:
            # If not found, create; if other error, re-raise.
            if "Qdrant error: 404" not in str(e):
                raise

        payload = {
            "vectors": {"size": int(vector_size), "distance": DEFAULT_DISTANCE},
        }
        await self._request("PUT", f"/collections/{self.collection}", json=payload)

    async def upsert_point(
        self,
        *,
        point_id: str,
        vector: list[float],
        payload: dict,
    ) -> None:
        body = {"points": [{"id": point_id, "vector": vector, "payload": payload}]}
        await self._request(
            "PUT", f"/collections/{self.collection}/points?wait=true", json=body
        )

    async def set_payload(self, *, point_id: str, payload: dict) -> None:
        body = {"payload": payload, "points": [point_id]}
        await self._request(
            "POST", f"/collections/{self.collection}/points/payload?wait=true", json=body
        )

    async def search(
        self,
        *,
        vector: list[float],
        limit: int = 5,
        equipment_id: Optional[str] = None,
    ) -> list[dict]:
        flt: dict | None = None
        if equipment_id:
            # equipment_ids is stored as array of strings in payload
            flt = {
                "must": [
                    {
                        "key": "equipment_ids",
                        "match": {"any": [equipment_id]},
                    }
                ]
            }
        body = {
            "vector": vector,
            "limit": int(limit),
            "with_payload": True,
            "with_vector": False,
        }
        if flt:
            body["filter"] = flt
        data = await self._request(
            "POST", f"/collections/{self.collection}/points/search", json=body
        )
        return (data.get("result") or []) if isinstance(data, dict) else []

