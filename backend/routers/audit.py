from fastapi import APIRouter, Depends, Query

from deps import require_role
from models import AuditLog, Member, MemberRole
from schemas import AuditOut

router = APIRouter(prefix="/projects/{project_id}/audit", tags=["audit"])


@router.get("", response_model=list[AuditOut])
async def list_audit(
    project_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _member: Member = Depends(require_role(MemberRole.VIEWER)),
) -> list[AuditLog]:
    return (
        await AuditLog.filter(project_id=project_id)
        .order_by("-created_at")
        .offset(offset)
        .limit(limit)
        .prefetch_related("actor")
    )
