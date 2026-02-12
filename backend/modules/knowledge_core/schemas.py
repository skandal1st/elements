from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


KnowledgeArticleStatus = Literal["draft", "unprocessed", "normalized", "published", "archived"]
KnowledgeArticleSource = Literal["manual", "ticket"]
NormalizedBy = Literal["llm", "user"]
ArticleType = Literal["instruction", "solution", "faq", "guide", "note"]
DifficultyLevel = Literal["beginner", "intermediate", "advanced"]


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------

class KnowledgeCategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    icon: Optional[str] = Field(None, max_length=64)
    color: Optional[str] = Field(None, max_length=32)
    parent_id: Optional[UUID] = None
    sort_order: int = 0


class KnowledgeCategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    icon: Optional[str] = Field(None, max_length=64)
    color: Optional[str] = Field(None, max_length=32)
    parent_id: Optional[UUID] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class KnowledgeCategoryOut(BaseModel):
    id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    parent_id: Optional[UUID] = None
    sort_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class KnowledgeCategoryTreeOut(KnowledgeCategoryOut):
    children: list["KnowledgeCategoryTreeOut"] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Tags
# ---------------------------------------------------------------------------

class KnowledgeTagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    color: Optional[str] = Field(None, max_length=32)


class KnowledgeTagOut(BaseModel):
    id: UUID
    name: str
    color: Optional[str] = None
    usage_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

class SearchResultItem(BaseModel):
    id: UUID
    title: str
    summary: Optional[str] = None
    status: str
    article_type: Optional[str] = None
    category_id: Optional[UUID] = None
    difficulty_level: Optional[str] = None
    views_count: int = 0
    helpful_count: int = 0
    tags: list[KnowledgeTagOut] = Field(default_factory=list)
    rank: float = 0.0
    updated_at: datetime

    model_config = {"from_attributes": True}


class SearchResponse(BaseModel):
    items: list[SearchResultItem]
    total: int
    query: str
    search_type: str


class AutocompleteResponse(BaseModel):
    suggestions: list[str]


# ---------------------------------------------------------------------------
# Articles
# ---------------------------------------------------------------------------

class KnowledgeArticleBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    status: KnowledgeArticleStatus = "draft"
    source: KnowledgeArticleSource = "manual"
    raw_content: Optional[str] = None
    normalized_content: Optional[str] = None
    normalization_version: int = 0
    normalized_by: Optional[NormalizedBy] = None
    created_from_ticket_id: Optional[UUID] = None
    equipment_ids: list[UUID] = Field(default_factory=list)
    linked_article_ids: list[UUID] = Field(default_factory=list)
    confidence_score: int = 0
    is_typical: bool = False
    article_type: Optional[ArticleType] = None
    category_id: Optional[UUID] = None
    summary: Optional[str] = None
    difficulty_level: Optional[DifficultyLevel] = None
    author_id: Optional[UUID] = None
    last_editor_id: Optional[UUID] = None
    reading_time_minutes: Optional[int] = None
    views_count: int = 0
    helpful_count: int = 0
    not_helpful_count: int = 0
    is_pinned: bool = False
    is_featured: bool = False
    published_at: Optional[datetime] = None


class KnowledgeArticleCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    raw_content: Optional[str] = None
    equipment_ids: list[UUID] = Field(default_factory=list)
    linked_article_ids: list[UUID] = Field(default_factory=list)
    article_type: Optional[ArticleType] = None
    category_id: Optional[UUID] = None
    summary: Optional[str] = None
    difficulty_level: Optional[DifficultyLevel] = None
    tag_ids: list[UUID] = Field(default_factory=list)


class KnowledgeArticleUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    status: Optional[KnowledgeArticleStatus] = None
    raw_content: Optional[str] = None
    equipment_ids: Optional[list[UUID]] = None
    linked_article_ids: Optional[list[UUID]] = None
    is_typical: Optional[bool] = None
    article_type: Optional[ArticleType] = None
    category_id: Optional[UUID] = None
    summary: Optional[str] = None
    difficulty_level: Optional[DifficultyLevel] = None
    tag_ids: Optional[list[UUID]] = None
    is_pinned: Optional[bool] = None
    is_featured: Optional[bool] = None


class KnowledgeArticleOut(KnowledgeArticleBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    tags: list[KnowledgeTagOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class ArticleFromTicketCreate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    problem: str = Field(..., min_length=1)
    actions: str = Field(..., min_length=1)
    solution: str = Field(..., min_length=1)
    is_typical: bool = False


class NormalizePreviewResponse(BaseModel):
    normalized_content: str
    normalization_version: int


class NormalizeConfirmRequest(BaseModel):
    normalized_content: str = Field(..., min_length=1)
    normalized_by: NormalizedBy = "user"


# ---------------------------------------------------------------------------
# Infra / Credentials (unchanged)
# ---------------------------------------------------------------------------

class NetworkDeviceBase(BaseModel):
    name: str
    model: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None


class NetworkDeviceCreate(NetworkDeviceBase):
    pass


class NetworkDeviceOut(NetworkDeviceBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PhysicalServerBase(BaseModel):
    name: str
    model: Optional[str] = None
    network_device_id: Optional[UUID] = None
    notes: Optional[str] = None


class PhysicalServerCreate(PhysicalServerBase):
    pass


class PhysicalServerOut(PhysicalServerBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VirtualServerBase(BaseModel):
    name: str
    host_physical_server_id: Optional[UUID] = None
    os: Optional[str] = None
    notes: Optional[str] = None


class VirtualServerCreate(VirtualServerBase):
    pass


class VirtualServerOut(VirtualServerBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ServiceBase(BaseModel):
    name: str
    virtual_server_id: Optional[UUID] = None
    type: Optional[str] = None
    notes: Optional[str] = None


class ServiceCreate(ServiceBase):
    pass


class ServiceOut(ServiceBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CredentialCreate(BaseModel):
    entity_type: str = Field(..., min_length=1, max_length=64)
    entity_id: UUID
    username: Optional[str] = Field(None, max_length=255)
    secret: str = Field(..., min_length=1)
    master_password: str = Field(..., min_length=1)


class CredentialListItem(BaseModel):
    id: UUID
    entity_type: str
    entity_id: UUID
    username: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CredentialRevealRequest(BaseModel):
    master_password: str = Field(..., min_length=1)


class CredentialRevealResponse(BaseModel):
    id: UUID
    entity_type: str
    entity_id: UUID
    username: Optional[str] = None
    secret: str
