from fastapi import APIRouter, Depends, HTTPException, status
from tortoise.transactions import in_transaction

from config import settings
from deps import get_current_user, require_role
from models import AuditAction, EntityType, Feature, Member, MemberRole, User
from schemas import (
    AiDraftRequest,
    AiDraftResponse,
    FeatureCreate,
    FeatureOut,
    FeatureReorder,
    FeatureUpdate,
)
from services import ai, audit

router = APIRouter(prefix="/projects/{project_id}/features", tags=["features"])


async def _get_feature_or_404(project_id: int, feature_id: int) -> Feature:
    feature = await Feature.get_or_none(id=feature_id, project_id=project_id)
    if feature is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return feature


@router.get("", response_model=list[FeatureOut])
async def list_features(
    project_id: int, _member: Member = Depends(require_role(MemberRole.VIEWER))
) -> list[Feature]:
    return await Feature.filter(project_id=project_id).order_by("position", "id")


@router.post("", response_model=FeatureOut, status_code=status.HTTP_201_CREATED)
async def create_feature(
    project_id: int,
    payload: FeatureCreate,
    current_user: User = Depends(get_current_user),
    _member: Member = Depends(require_role(MemberRole.EDITOR)),
) -> Feature:
    feature = await Feature.create(project_id=project_id, **payload.model_dump())
    await audit.record(
        project_id=project_id,
        actor=current_user,
        action=AuditAction.CREATE,
        entity_type=EntityType.FEATURE,
        entity_id=feature.id,
        summary=f"Created feature '{feature.title}'",
    )
    return feature


@router.post("/reorder", response_model=list[FeatureOut])
async def reorder_features(
    project_id: int,
    payload: FeatureReorder,
    current_user: User = Depends(get_current_user),
    _member: Member = Depends(require_role(MemberRole.EDITOR)),
) -> list[Feature]:
    ids = [item.id for item in payload.items]
    existing = {
        f.id: f for f in await Feature.filter(project_id=project_id, id__in=ids)
    }
    missing = set(ids) - set(existing)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Features not in project: {sorted(missing)}",
        )
    async with in_transaction():
        for item in payload.items:
            feature = existing[item.id]
            feature.position = item.position
            if item.status is not None:
                feature.status = item.status
            if item.roadmap_bucket is not None:
                feature.roadmap_bucket = item.roadmap_bucket
            await feature.save()
    await audit.record(
        project_id=project_id,
        actor=current_user,
        action=AuditAction.UPDATE,
        entity_type=EntityType.FEATURE,
        entity_id=0,
        summary=f"Reordered {len(ids)} feature(s)",
    )
    return await Feature.filter(project_id=project_id).order_by("position", "id")


@router.post("/ai-draft", response_model=AiDraftResponse)
async def ai_draft_features(
    project_id: int,
    payload: AiDraftRequest,
    _member: Member = Depends(require_role(MemberRole.EDITOR)),
) -> AiDraftResponse:
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI drafting is not configured (ANTHROPIC_API_KEY unset)",
        )
    drafts = await ai.draft_features_from_text(payload.text)
    return AiDraftResponse(drafts=drafts)


@router.get("/{feature_id}", response_model=FeatureOut)
async def get_feature(
    project_id: int,
    feature_id: int,
    _member: Member = Depends(require_role(MemberRole.VIEWER)),
) -> Feature:
    return await _get_feature_or_404(project_id, feature_id)


@router.patch("/{feature_id}", response_model=FeatureOut)
async def update_feature(
    project_id: int,
    feature_id: int,
    payload: FeatureUpdate,
    current_user: User = Depends(get_current_user),
    _member: Member = Depends(require_role(MemberRole.EDITOR)),
) -> Feature:
    feature = await _get_feature_or_404(project_id, feature_id)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(feature, field, value)
    await feature.save()
    await audit.record(
        project_id=project_id,
        actor=current_user,
        action=AuditAction.UPDATE,
        entity_type=EntityType.FEATURE,
        entity_id=feature.id,
        summary=f"Updated feature fields: {', '.join(data) or 'none'}",
    )
    return feature


@router.delete("/{feature_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_feature(
    project_id: int,
    feature_id: int,
    current_user: User = Depends(get_current_user),
    _member: Member = Depends(require_role(MemberRole.EDITOR)),
) -> None:
    feature = await _get_feature_or_404(project_id, feature_id)
    title = feature.title
    await feature.delete()
    await audit.record(
        project_id=project_id,
        actor=current_user,
        action=AuditAction.DELETE,
        entity_type=EntityType.FEATURE,
        entity_id=feature_id,
        summary=f"Deleted feature '{title}'",
    )
