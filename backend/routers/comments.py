from fastapi import APIRouter, Depends, HTTPException, Query, status

from deps import get_current_user, require_role
from models import (
    AuditAction,
    Comment,
    EntityType,
    Member,
    MemberRole,
    User,
)
from schemas import CommentCreate, CommentOut
from services import audit

router = APIRouter(prefix="/projects/{project_id}/comments", tags=["comments"])


@router.get("", response_model=list[CommentOut])
async def list_comments(
    project_id: int,
    entity_type: EntityType | None = Query(default=None),
    entity_id: int | None = Query(default=None),
    _member: Member = Depends(require_role(MemberRole.VIEWER)),
) -> list[Comment]:
    filters: dict[str, object] = {"project_id": project_id}
    if entity_type is not None:
        filters["entity_type"] = entity_type
    if entity_id is not None:
        filters["entity_id"] = entity_id
    return (
        await Comment.filter(**filters)
        .order_by("created_at")
        .prefetch_related("author")
    )


@router.post("", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
async def create_comment(
    project_id: int,
    payload: CommentCreate,
    current_user: User = Depends(get_current_user),
    _member: Member = Depends(require_role(MemberRole.EDITOR)),
) -> Comment:
    comment = await Comment.create(
        project_id=project_id,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        author=current_user,
        body=payload.body,
    )
    await comment.fetch_related("author")
    await audit.record(
        project_id=project_id,
        actor=current_user,
        action=AuditAction.CREATE,
        entity_type=EntityType.COMMENT,
        entity_id=comment.id,
        summary=f"Commented on {payload.entity_type.value} #{payload.entity_id}",
    )
    return comment


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    project_id: int,
    comment_id: int,
    current_user: User = Depends(get_current_user),
    member: Member = Depends(require_role(MemberRole.VIEWER)),
) -> None:
    comment = await Comment.get_or_none(id=comment_id, project_id=project_id)
    if comment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    # Author can delete their own comment; project owners can delete any.
    if comment.author_id != current_user.id and member.role != MemberRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the author or a project owner can delete this comment",
        )
    await comment.delete()
    await audit.record(
        project_id=project_id,
        actor=current_user,
        action=AuditAction.DELETE,
        entity_type=EntityType.COMMENT,
        entity_id=comment_id,
        summary="Deleted comment",
    )
