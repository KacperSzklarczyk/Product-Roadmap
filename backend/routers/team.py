from fastapi import APIRouter, Depends

from deps import get_current_user, require_role
from models import AuditAction, EntityType, Member, MemberRole, TeamComposition, User
from schemas import TeamCompositionIn, TeamCompositionOut
from services import audit

router = APIRouter(prefix="/projects/{project_id}/team", tags=["team"])


async def _get_or_create(project_id: int) -> TeamComposition:
    team = await TeamComposition.get_or_none(project_id=project_id)
    if team is None:
        team = await TeamComposition.create(project_id=project_id)
    return team


@router.get("", response_model=TeamCompositionOut)
async def get_team(
    project_id: int,
    _member: Member = Depends(require_role(MemberRole.VIEWER)),
) -> TeamComposition:
    return await _get_or_create(project_id)


@router.put("", response_model=TeamCompositionOut)
async def update_team(
    project_id: int,
    payload: TeamCompositionIn,
    current_user: User = Depends(get_current_user),
    _member: Member = Depends(require_role(MemberRole.EDITOR)),
) -> TeamComposition:
    team = await _get_or_create(project_id)
    for field, value in payload.model_dump().items():
        setattr(team, field, value)
    await team.save()
    await audit.record(
        project_id=project_id,
        actor=current_user,
        action=AuditAction.UPDATE,
        entity_type=EntityType.PROJECT,
        entity_id=project_id,
        summary="Updated team composition & sprint cadence",
    )
    return team
