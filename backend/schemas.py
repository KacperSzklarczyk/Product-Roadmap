from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from models import (
    AuditAction,
    EntityType,
    FeatureStatus,
    MemberRole,
    MilestoneStatus,
    RoadmapBucket,
)

ALLOWED_IMPACT = {0.25, 0.5, 1.0, 2.0, 3.0}


# ---------------------------------------------------------------------------
# Auth / users
# ---------------------------------------------------------------------------
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str | None
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------
class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    owner_id: int
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Features (classic RICE)
# ---------------------------------------------------------------------------
class _FeatureRICEMixin(BaseModel):
    @field_validator("impact", check_fields=False)
    @classmethod
    def _impact_allowed(cls, v: float | None) -> float | None:
        if v is not None and v not in ALLOWED_IMPACT:
            raise ValueError(f"impact must be one of {sorted(ALLOWED_IMPACT)}")
        return v

    @field_validator("effort", check_fields=False)
    @classmethod
    def _effort_positive(cls, v: float | None) -> float | None:
        if v is not None and v <= 0:
            raise ValueError("effort must be > 0")
        return v


class FeatureCreate(_FeatureRICEMixin):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    status: FeatureStatus = FeatureStatus.BACKLOG
    roadmap_bucket: RoadmapBucket = RoadmapBucket.LATER
    reach: int = Field(default=0, ge=0)
    impact: float = 1.0
    confidence: int = Field(default=100, ge=0, le=100)
    effort: float = 1.0
    position: int = Field(default=0, ge=0)


class FeatureUpdate(_FeatureRICEMixin):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    status: FeatureStatus | None = None
    roadmap_bucket: RoadmapBucket | None = None
    reach: int | None = Field(default=None, ge=0)
    impact: float | None = None
    confidence: int | None = Field(default=None, ge=0, le=100)
    effort: float | None = None
    position: int | None = Field(default=None, ge=0)


class FeatureOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    title: str
    description: str | None
    status: FeatureStatus
    roadmap_bucket: RoadmapBucket
    reach: int
    impact: float
    confidence: int
    effort: float
    position: int
    rice_score: float
    created_at: datetime
    updated_at: datetime


class FeatureReorderItem(BaseModel):
    id: int
    position: int = Field(ge=0)
    status: FeatureStatus | None = None
    roadmap_bucket: RoadmapBucket | None = None


class FeatureReorder(BaseModel):
    items: list[FeatureReorderItem] = Field(min_length=1)


# ---------------------------------------------------------------------------
# AI feature drafting
# ---------------------------------------------------------------------------
class AiDraftRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20000)


class FeatureDraft(_FeatureRICEMixin):
    """A non-persisted feature suggestion extracted by the AI from freeform text."""

    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    status: FeatureStatus = FeatureStatus.BACKLOG
    roadmap_bucket: RoadmapBucket = RoadmapBucket.LATER
    reach: int = Field(default=0, ge=0)
    impact: float = 1.0
    confidence: int = Field(default=50, ge=0, le=100)
    effort: float = 1.0


class AiDraftResponse(BaseModel):
    drafts: list[FeatureDraft]


# ---------------------------------------------------------------------------
# AI roadmap review + ask
# ---------------------------------------------------------------------------
class Finding(BaseModel):
    severity: str  # high | medium | low
    title: str
    rationale: str
    feature_ids: list[int] = []


class AiReviewResponse(BaseModel):
    findings: list[Finding]


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


class AskResponse(BaseModel):
    answer: str


# ---------------------------------------------------------------------------
# Milestones
# ---------------------------------------------------------------------------
class MilestoneCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    due_date: date | None = None
    status: MilestoneStatus = MilestoneStatus.PLANNED


class MilestoneUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    due_date: date | None = None
    status: MilestoneStatus | None = None


class MilestoneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    title: str
    description: str | None
    due_date: date | None
    status: MilestoneStatus
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------
class MemberCreate(BaseModel):
    email: EmailStr
    role: MemberRole = MemberRole.VIEWER


class MemberUpdate(BaseModel):
    role: MemberRole


class MemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    role: MemberRole
    user: UserOut
    created_at: datetime


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------
class CommentCreate(BaseModel):
    entity_type: EntityType
    entity_id: int
    body: str = Field(min_length=1)


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    entity_type: EntityType
    entity_id: int
    body: str
    author: UserOut
    created_at: datetime


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------
class AuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    action: AuditAction
    entity_type: EntityType
    entity_id: int
    summary: str | None
    actor: UserOut
    created_at: datetime
