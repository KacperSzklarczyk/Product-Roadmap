from fastapi import APIRouter, Depends, HTTPException, status

from deps import get_current_user, require_role
from models import AuditAction, EntityType, Member, MemberRole, Milestone, User
from schemas import MilestoneCreate, MilestoneOut, MilestoneUpdate
from services import audit

router = APIRouter(prefix="/projects/{project_id}/milestones", tags=["milestones"])


async def _get_milestone_or_404(project_id: int, milestone_id: int) -> Milestone:
    milestone = await Milestone.get_or_none(id=milestone_id, project_id=project_id)
    if milestone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return milestone


@router.get("", response_model=list[MilestoneOut])
async def list_milestones(
    project_id: int, _member: Member = Depends(require_role(MemberRole.VIEWER))
) -> list[Milestone]:
    return await Milestone.filter(project_id=project_id).order_by("due_date", "id")


@router.post("", response_model=MilestoneOut, status_code=status.HTTP_201_CREATED)
async def create_milestone(
    project_id: int,
    payload: MilestoneCreate,
    current_user: User = Depends(get_current_user),
    _member: Member = Depends(require_role(MemberRole.EDITOR)),
) -> Milestone:
    milestone = await Milestone.create(project_id=project_id, **payload.model_dump())
    await audit.record(
        project_id=project_id,
        actor=current_user,
        action=AuditAction.CREATE,
        entity_type=EntityType.MILESTONE,
        entity_id=milestone.id,
        summary=f"Created milestone '{milestone.title}'",
    )
    return milestone


@router.get("/{milestone_id}", response_model=MilestoneOut)
async def get_milestone(
    project_id: int,
    milestone_id: int,
    _member: Member = Depends(require_role(MemberRole.VIEWER)),
) -> Milestone:
    return await _get_milestone_or_404(project_id, milestone_id)


@router.patch("/{milestone_id}", response_model=MilestoneOut)
async def update_milestone(
    project_id: int,
    milestone_id: int,
    payload: MilestoneUpdate,
    current_user: User = Depends(get_current_user),
    _member: Member = Depends(require_role(MemberRole.EDITOR)),
) -> Milestone:
    milestone = await _get_milestone_or_404(project_id, milestone_id)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(milestone, field, value)
    await milestone.save()
    await audit.record(
        project_id=project_id,
        actor=current_user,
        action=AuditAction.UPDATE,
        entity_type=EntityType.MILESTONE,
        entity_id=milestone.id,
        summary=f"Updated milestone fields: {', '.join(data) or 'none'}",
    )
    return milestone


@router.delete("/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_milestone(
    project_id: int,
    milestone_id: int,
    current_user: User = Depends(get_current_user),
    _member: Member = Depends(require_role(MemberRole.EDITOR)),
) -> None:
    milestone = await _get_milestone_or_404(project_id, milestone_id)
    title = milestone.title
    await milestone.delete()
    await audit.record(
        project_id=project_id,
        actor=current_user,
        action=AuditAction.DELETE,
        entity_type=EntityType.MILESTONE,
        entity_id=milestone_id,
        summary=f"Deleted milestone '{title}'",
    )
