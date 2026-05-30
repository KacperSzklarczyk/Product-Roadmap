from models import AuditAction, AuditLog, EntityType, User


async def record(
    *,
    project_id: int,
    actor: User,
    action: AuditAction,
    entity_type: EntityType,
    entity_id: int,
    summary: str | None = None,
) -> AuditLog:
    """Write a single append-only audit entry. Called by every mutating route."""
    return await AuditLog.create(
        project_id=project_id,
        actor_id=actor.id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        summary=summary,
    )
