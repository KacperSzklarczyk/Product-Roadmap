from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status

from config import settings
from deps import get_current_user, require_role
from models import (
    AuditAction,
    AuditLog,
    EntityType,
    Feature,
    FeatureStatus,
    Member,
    MemberRole,
    Milestone,
    MilestoneStatus,
    RoadmapBucket,
    User,
)
from schemas import AiFixResponse, AiReviewResponse, AskRequest, AskResponse, Finding
from services import ai, audit

router = APIRouter(prefix="/projects/{project_id}/ai", tags=["ai"])


def _require_key() -> None:
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI is not configured (ANTHROPIC_API_KEY unset)",
        )


async def _load(project_id: int):
    features = await Feature.filter(project_id=project_id)
    milestones = await Milestone.filter(project_id=project_id)
    activity = (
        await AuditLog.filter(project_id=project_id)
        .order_by("-created_at")
        .limit(40)
        .prefetch_related("actor")
    )
    return features, milestones, activity


@router.post("/review", response_model=AiReviewResponse)
async def review_roadmap(
    project_id: int,
    _member: Member = Depends(require_role(MemberRole.VIEWER)),
) -> AiReviewResponse:
    _require_key()
    features, milestones, activity = await _load(project_id)
    findings = await ai.review_roadmap(features, milestones, activity)
    return AiReviewResponse(findings=findings)


@router.post("/ask", response_model=AskResponse)
async def ask_roadmap(
    project_id: int,
    payload: AskRequest,
    _member: Member = Depends(require_role(MemberRole.VIEWER)),
) -> AskResponse:
    _require_key()
    features, milestones, activity = await _load(project_id)
    answer = await ai.ask_roadmap(payload.question, features, milestones, activity)
    return AskResponse(answer=answer)


def _apply_feature_update(feature: Feature, upd: dict) -> list[str]:
    """Validate + apply a single feature update; return human-readable change strings."""
    changes: list[str] = []
    if "roadmap_bucket" in upd:
        try:
            new = RoadmapBucket(upd["roadmap_bucket"])
            if new != feature.roadmap_bucket:
                changes.append(f"bucket {feature.roadmap_bucket.value} → {new.value}")
                feature.roadmap_bucket = new
        except ValueError:
            pass
    if "status" in upd:
        try:
            new = FeatureStatus(upd["status"])
            if new != feature.status:
                changes.append(f"status {feature.status.value} → {new.value}")
                feature.status = new
        except ValueError:
            pass
    if "reach" in upd:
        new = max(0, int(upd["reach"]))
        if new != feature.reach:
            changes.append(f"reach {feature.reach} → {new}")
            feature.reach = new
    if "impact" in upd:
        new = ai._nearest_impact(float(upd["impact"]))
        if new != feature.impact:
            changes.append(f"impact {feature.impact} → {new}")
            feature.impact = new
    if "confidence" in upd:
        new = min(100, max(0, int(upd["confidence"])))
        if new != feature.confidence:
            changes.append(f"confidence {feature.confidence}% → {new}%")
            feature.confidence = new
    if "effort" in upd:
        new = max(0.1, float(upd["effort"]))
        if new != feature.effort:
            changes.append(f"effort {feature.effort}pm → {new}pm")
            feature.effort = new
    return changes


def _apply_milestone_update(milestone: Milestone, upd: dict) -> list[str]:
    changes: list[str] = []
    if "due_date" in upd and upd["due_date"]:
        try:
            new_due = date.fromisoformat(upd["due_date"])
            if new_due != milestone.due_date:
                changes.append(f"due {milestone.due_date} → {new_due}")
                milestone.due_date = new_due
        except ValueError:
            pass
    if "status" in upd:
        try:
            new = MilestoneStatus(upd["status"])
            if new != milestone.status:
                changes.append(f"status {milestone.status.value} → {new.value}")
                milestone.status = new
        except ValueError:
            pass
    return changes


@router.post("/fix", response_model=AiFixResponse)
async def fix_finding(
    project_id: int,
    payload: Finding,
    current_user: User = Depends(get_current_user),
    _member: Member = Depends(require_role(MemberRole.EDITOR)),
) -> AiFixResponse:
    _require_key()
    features, milestones, _ = await _load(project_id)
    plan = await ai.fix_finding(payload, features, milestones)

    features_by_id = {f.id: f for f in features}
    milestones_by_id = {m.id: m for m in milestones}
    all_changes: list[str] = []
    updated_feature_ids: list[int] = []
    updated_milestone_ids: list[int] = []

    for upd in plan.get("feature_updates", []):
        feature = features_by_id.get(upd.get("feature_id"))
        if feature is None:
            continue
        changes = _apply_feature_update(feature, upd)
        if changes:
            await feature.save()
            updated_feature_ids.append(feature.id)
            all_changes.append(f"{feature.title}: {', '.join(changes)}")
            await audit.record(
                project_id=project_id,
                actor=current_user,
                action=AuditAction.UPDATE,
                entity_type=EntityType.FEATURE,
                entity_id=feature.id,
                summary=f"AI fix — {'; '.join(changes)}",
            )

    for upd in plan.get("milestone_updates", []):
        milestone = milestones_by_id.get(upd.get("milestone_id"))
        if milestone is None:
            continue
        changes = _apply_milestone_update(milestone, upd)
        if changes:
            await milestone.save()
            updated_milestone_ids.append(milestone.id)
            all_changes.append(f"Milestone '{milestone.title}': {', '.join(changes)}")
            await audit.record(
                project_id=project_id,
                actor=current_user,
                action=AuditAction.UPDATE,
                entity_type=EntityType.MILESTONE,
                entity_id=milestone.id,
                summary=f"AI fix — {'; '.join(changes)}",
            )

    summary = str(plan.get("summary", "")).strip()
    if not all_changes and not summary:
        summary = "No automatic changes were applicable for this finding."
    return AiFixResponse(
        summary=summary,
        changes=all_changes,
        updated_feature_ids=updated_feature_ids,
        updated_milestone_ids=updated_milestone_ids,
    )
