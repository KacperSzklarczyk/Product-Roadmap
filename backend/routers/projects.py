from fastapi import APIRouter, Depends, HTTPException, status

from deps import get_current_user, require_role
from models import (
    AuditAction,
    EntityType,
    Member,
    MemberRole,
    Project,
    User,
)
from schemas import ProjectCreate, ProjectOut, ProjectUpdate
from services import audit

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate, current_user: User = Depends(get_current_user)
) -> Project:
    project = await Project.create(
        name=payload.name, description=payload.description, owner=current_user
    )
    # The creator is automatically an owner-level member.
    await Member.create(project=project, user=current_user, role=MemberRole.OWNER)
    await audit.record(
        project_id=project.id,
        actor=current_user,
        action=AuditAction.CREATE,
        entity_type=EntityType.PROJECT,
        entity_id=project.id,
        summary=f"Created project '{project.name}'",
    )
    return project


@router.get("", response_model=list[ProjectOut])
async def list_projects(current_user: User = Depends(get_current_user)) -> list[Project]:
    # Only projects the caller is a member of. Prefetch project to avoid N+1.
    memberships = await Member.filter(user_id=current_user.id).prefetch_related(
        "project"
    )
    return [m.project for m in memberships]


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: int, _member: Member = Depends(require_role(MemberRole.VIEWER))
) -> Project:
    project = await Project.get_or_none(id=project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: int,
    payload: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    _member: Member = Depends(require_role(MemberRole.EDITOR)),
) -> Project:
    project = await Project.get_or_none(id=project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(project, field, value)
    await project.save()
    await audit.record(
        project_id=project.id,
        actor=current_user,
        action=AuditAction.UPDATE,
        entity_type=EntityType.PROJECT,
        entity_id=project.id,
        summary=f"Updated project fields: {', '.join(data) or 'none'}",
    )
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int, _member: Member = Depends(require_role(MemberRole.OWNER))
) -> None:
    project = await Project.get_or_none(id=project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    # Deleting the project cascades to all its features/milestones/members/audit
    # logs, so a delete audit entry would be cascade-removed — intentionally skipped.
    await project.delete()
