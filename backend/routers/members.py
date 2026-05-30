from fastapi import APIRouter, Depends, HTTPException, status

from deps import get_current_user, require_role
from models import AuditAction, EntityType, Member, MemberRole, User
from schemas import MemberCreate, MemberOut, MemberUpdate
from services import audit

router = APIRouter(prefix="/projects/{project_id}/members", tags=["members"])


async def _get_member_or_404(project_id: int, member_id: int) -> Member:
    member = await Member.get_or_none(id=member_id, project_id=project_id)
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return member


async def _owner_count(project_id: int) -> int:
    return await Member.filter(project_id=project_id, role=MemberRole.OWNER).count()


@router.get("", response_model=list[MemberOut])
async def list_members(
    project_id: int, _member: Member = Depends(require_role(MemberRole.VIEWER))
) -> list[Member]:
    return await Member.filter(project_id=project_id).prefetch_related("user")


@router.post("", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
async def add_member(
    project_id: int,
    payload: MemberCreate,
    current_user: User = Depends(get_current_user),
    _member: Member = Depends(require_role(MemberRole.OWNER)),
) -> Member:
    user = await User.get_or_none(email=payload.email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No user with that email"
        )
    if await Member.exists(project_id=project_id, user_id=user.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Already a member"
        )
    member = await Member.create(
        project_id=project_id, user=user, role=payload.role
    )
    await member.fetch_related("user")
    await audit.record(
        project_id=project_id,
        actor=current_user,
        action=AuditAction.CREATE,
        entity_type=EntityType.MEMBER,
        entity_id=member.id,
        summary=f"Added member {user.email} as {payload.role.value}",
    )
    return member


@router.patch("/{member_id}", response_model=MemberOut)
async def update_member_role(
    project_id: int,
    member_id: int,
    payload: MemberUpdate,
    current_user: User = Depends(get_current_user),
    _member: Member = Depends(require_role(MemberRole.OWNER)),
) -> Member:
    member = await _get_member_or_404(project_id, member_id)
    # Don't allow demoting the last remaining owner.
    if (
        member.role == MemberRole.OWNER
        and payload.role != MemberRole.OWNER
        and await _owner_count(project_id) <= 1
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot demote the last owner",
        )
    member.role = payload.role
    await member.save()
    await member.fetch_related("user")
    await audit.record(
        project_id=project_id,
        actor=current_user,
        action=AuditAction.UPDATE,
        entity_type=EntityType.MEMBER,
        entity_id=member.id,
        summary=f"Changed member {member.user.email} role to {payload.role.value}",
    )
    return member


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    project_id: int,
    member_id: int,
    current_user: User = Depends(get_current_user),
    _member: Member = Depends(require_role(MemberRole.OWNER)),
) -> None:
    member = await _get_member_or_404(project_id, member_id)
    if member.role == MemberRole.OWNER and await _owner_count(project_id) <= 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot remove the last owner",
        )
    await member.fetch_related("user")
    email = member.user.email
    await member.delete()
    await audit.record(
        project_id=project_id,
        actor=current_user,
        action=AuditAction.DELETE,
        entity_type=EntityType.MEMBER,
        entity_id=member_id,
        summary=f"Removed member {email}",
    )
