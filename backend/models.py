from enum import Enum

from tortoise import fields
from tortoise.models import Model


# ---------------------------------------------------------------------------
# Enums (shared by Tortoise CharEnumField and the Pydantic schemas)
# ---------------------------------------------------------------------------
class FeatureStatus(str, Enum):
    BACKLOG = "backlog"
    IN_PROGRESS = "in_progress"
    DONE = "done"


class RoadmapBucket(str, Enum):
    NOW = "now"
    NEXT = "next"
    LATER = "later"


class MilestoneStatus(str, Enum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class MemberRole(str, Enum):
    OWNER = "owner"
    EDITOR = "editor"
    VIEWER = "viewer"


class EntityType(str, Enum):
    PROJECT = "project"
    FEATURE = "feature"
    MILESTONE = "milestone"
    MEMBER = "member"
    COMMENT = "comment"


class AuditAction(str, Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class TimestampMixin(Model):
    """Abstract base adding created_at / updated_at to every concrete model."""

    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        abstract = True


class User(TimestampMixin):
    id = fields.IntField(pk=True)
    email = fields.CharField(max_length=255, unique=True, index=True)
    hashed_password = fields.CharField(max_length=255)
    full_name = fields.CharField(max_length=255, null=True)
    is_active = fields.BooleanField(default=True)

    projects: fields.ReverseRelation["Project"]
    memberships: fields.ReverseRelation["Member"]

    class Meta:
        table = "users"

    def __str__(self) -> str:
        return self.email


class Project(TimestampMixin):
    id = fields.IntField(pk=True)
    name = fields.CharField(max_length=255)
    description = fields.TextField(null=True)
    owner: fields.ForeignKeyRelation[User] = fields.ForeignKeyField(
        "models.User", related_name="projects", on_delete=fields.CASCADE
    )

    features: fields.ReverseRelation["Feature"]
    milestones: fields.ReverseRelation["Milestone"]
    members: fields.ReverseRelation["Member"]

    class Meta:
        table = "projects"

    def __str__(self) -> str:
        return self.name


class Feature(TimestampMixin):
    id = fields.IntField(pk=True)
    project: fields.ForeignKeyRelation[Project] = fields.ForeignKeyField(
        "models.Project", related_name="features", on_delete=fields.CASCADE
    )
    title = fields.CharField(max_length=255)
    description = fields.TextField(null=True)
    status = fields.CharEnumField(FeatureStatus, default=FeatureStatus.BACKLOG)
    roadmap_bucket = fields.CharEnumField(RoadmapBucket, default=RoadmapBucket.LATER)

    # Classic RICE inputs.
    reach = fields.IntField(default=0)
    impact = fields.FloatField(default=1.0)  # ∈ {0.25, 0.5, 1, 2, 3}
    confidence = fields.IntField(default=100)  # percent, 0–100
    effort = fields.FloatField(default=1.0)  # person-months, > 0

    position = fields.IntField(default=0)  # ordering within board/bucket

    class Meta:
        table = "features"

    @property
    def rice_score(self) -> float:
        """RICE = Reach × Impact × Confidence% / Effort."""
        if not self.effort:
            return 0.0
        return round(self.reach * self.impact * (self.confidence / 100) / self.effort, 2)

    def __str__(self) -> str:
        return self.title


class Milestone(TimestampMixin):
    id = fields.IntField(pk=True)
    project: fields.ForeignKeyRelation[Project] = fields.ForeignKeyField(
        "models.Project", related_name="milestones", on_delete=fields.CASCADE
    )
    title = fields.CharField(max_length=255)
    description = fields.TextField(null=True)
    due_date = fields.DateField(null=True)
    status = fields.CharEnumField(MilestoneStatus, default=MilestoneStatus.PLANNED)

    class Meta:
        table = "milestones"

    def __str__(self) -> str:
        return self.title


class Member(TimestampMixin):
    id = fields.IntField(pk=True)
    project: fields.ForeignKeyRelation[Project] = fields.ForeignKeyField(
        "models.Project", related_name="members", on_delete=fields.CASCADE
    )
    user: fields.ForeignKeyRelation[User] = fields.ForeignKeyField(
        "models.User", related_name="memberships", on_delete=fields.CASCADE
    )
    role = fields.CharEnumField(MemberRole, default=MemberRole.VIEWER)

    class Meta:
        table = "members"
        unique_together = (("project", "user"),)

    def __str__(self) -> str:
        return f"{self.user_id}:{self.role}"


class Comment(TimestampMixin):
    """Polymorphic comment: attaches to a project / feature / milestone within a project."""

    id = fields.IntField(pk=True)
    project: fields.ForeignKeyRelation[Project] = fields.ForeignKeyField(
        "models.Project", related_name="comments", on_delete=fields.CASCADE
    )
    entity_type = fields.CharEnumField(EntityType)
    entity_id = fields.IntField()
    author: fields.ForeignKeyRelation[User] = fields.ForeignKeyField(
        "models.User", related_name="comments", on_delete=fields.CASCADE
    )
    body = fields.TextField()

    class Meta:
        table = "comments"


class AuditLog(Model):
    """Append-only record of every mutation. No updated_at by design."""

    id = fields.IntField(pk=True)
    project: fields.ForeignKeyRelation[Project] = fields.ForeignKeyField(
        "models.Project", related_name="audit_logs", on_delete=fields.CASCADE
    )
    actor: fields.ForeignKeyRelation[User] = fields.ForeignKeyField(
        "models.User", related_name="audit_actions", on_delete=fields.CASCADE
    )
    action = fields.CharEnumField(AuditAction)
    entity_type = fields.CharEnumField(EntityType)
    entity_id = fields.IntField()
    summary = fields.CharField(max_length=255, null=True)
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "audit_logs"
