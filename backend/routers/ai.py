from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status

from config import settings
from deps import get_current_user, require_role
from models import (
    AuditAction,
    AuditLog,
    EntityType,
    Feature,
    FeatureSpecialization,
    FeatureStatus,
    Member,
    MemberRole,
    Milestone,
    MilestoneStatus,
    RoadmapBucket,
    TeamComposition,
    User,
)
from schemas import (
    AiFixApplyResult,
    AiFixPreview,
    AiReviewResponse,
    AskRequest,
    AskResponse,
    Finding,
    FixApplyRequest,
    FixChange,
)
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
    team = await TeamComposition.get_or_none(project_id=project_id)
    return features, milestones, activity, team


@router.post("/review", response_model=AiReviewResponse)
async def review_roadmap(
    project_id: int,
    _member: Member = Depends(require_role(MemberRole.VIEWER)),
) -> AiReviewResponse:
    _require_key()
    features, milestones, activity, team = await _load(project_id)
    findings = await ai.review_roadmap(features, milestones, activity, team)
    return AiReviewResponse(findings=findings)


@router.post("/ask", response_model=AskResponse)
async def ask_roadmap(
    project_id: int,
    payload: AskRequest,
    _member: Member = Depends(require_role(MemberRole.VIEWER)),
) -> AskResponse:
    _require_key()
    features, milestones, activity, team = await _load(project_id)
    result = await ai.ask_roadmap(payload.question, features, milestones, activity, team)
    return AskResponse(**result)


# --- single-field validation: resolve a (feature|milestone, field, raw value) into a
# typed value + display strings. Used by BOTH preview (diff) and apply (set). ---
def _feature_field(feature: Feature, field: str, raw) -> tuple[str, object, str, str] | None:
    """Return (current_str, proposed_value, proposed_str, label) for a valid field change,
    or None if the field/value is invalid. Does NOT mutate."""
    try:
        if field == "roadmap_bucket":
            pv = RoadmapBucket(raw)
            cur = feature.roadmap_bucket.value
            return cur, pv, pv.value, f"Move from {cur} to {pv.value}"
        if field == "status":
            pv = FeatureStatus(raw)
            cur = feature.status.value
            return cur, pv, pv.value, f"Status {cur} → {pv.value}"
        if field == "specialization":
            pv = FeatureSpecialization(raw)
            cur = feature.specialization.value if feature.specialization else "unspecified"
            return cur, pv, pv.value, f"Specialization {cur} → {pv.value}"
        if field == "reach":
            pv = max(0, int(float(raw)))
            return str(feature.reach), pv, str(pv), f"Reach {feature.reach} → {pv}"
        if field == "impact":
            pv = ai._nearest_impact(float(raw))
            return str(feature.impact), pv, str(pv), f"Impact {feature.impact} → {pv}"
        if field == "confidence":
            pv = min(100, max(0, int(float(raw))))
            return f"{feature.confidence}%", pv, f"{pv}%", f"Confidence {feature.confidence}% → {pv}%"
        if field == "effort":
            pv = max(0.1, round(float(raw), 2))
            return f"{feature.effort}pm", pv, f"{pv}pm", f"Effort {feature.effort}pm → {pv}pm"
    except (ValueError, TypeError):
        return None
    return None


def _milestone_field(milestone: Milestone, field: str, raw) -> tuple[str, object, str, str] | None:
    try:
        if field == "due_date":
            pv = date.fromisoformat(str(raw))
            cur = milestone.due_date.isoformat() if milestone.due_date else "unset"
            return cur, pv, pv.isoformat(), f"Due date {cur} → {pv.isoformat()}"
        if field == "status":
            pv = MilestoneStatus(raw)
            cur = milestone.status.value
            return cur, pv, pv.value, f"Status {cur} → {pv.value}"
    except (ValueError, TypeError):
        return None
    return None


@router.post("/fix", response_model=AiFixPreview)
async def preview_fix(
    project_id: int,
    payload: Finding,
    _member: Member = Depends(require_role(MemberRole.EDITOR)),
) -> AiFixPreview:
    """Ask the AI for a plan and return discrete proposed changes WITHOUT applying them."""
    _require_key()
    features, milestones, _, team = await _load(project_id)
    plan = await ai.fix_finding(payload, features, milestones, team)

    features_by_id = {f.id: f for f in features}
    milestones_by_id = {m.id: m for m in milestones}
    changes: list[FixChange] = []

    for upd in plan.get("feature_updates", []):
        feature = features_by_id.get(upd.get("feature_id"))
        if feature is None:
            continue
        for field, raw in upd.items():
            if field == "feature_id":
                continue
            res = _feature_field(feature, field, raw)
            if res is None:
                continue
            cur, _pv, prop, label = res
            if cur == prop:
                continue
            changes.append(
                FixChange(
                    id=f"feature:{feature.id}:{field}",
                    target="feature",
                    entity_id=feature.id,
                    entity_title=feature.title,
                    field=field,
                    label=label,
                    current=cur,
                    proposed=prop,
                )
            )

    for upd in plan.get("milestone_updates", []):
        milestone = milestones_by_id.get(upd.get("milestone_id"))
        if milestone is None:
            continue
        for field, raw in upd.items():
            if field == "milestone_id" or raw in (None, ""):
                continue
            res = _milestone_field(milestone, field, raw)
            if res is None:
                continue
            cur, _pv, prop, label = res
            if cur == prop:
                continue
            changes.append(
                FixChange(
                    id=f"milestone:{milestone.id}:{field}",
                    target="milestone",
                    entity_id=milestone.id,
                    entity_title=milestone.title,
                    field=field,
                    label=label,
                    current=cur,
                    proposed=prop,
                )
            )

    summary = str(plan.get("summary", "")).strip()
    if not changes:
        summary = summary or "No automatic changes are applicable for this finding."
    return AiFixPreview(summary=summary, changes=changes)


@router.post("/fix/apply", response_model=AiFixApplyResult)
async def apply_fix(
    project_id: int,
    payload: FixApplyRequest,
    current_user: User = Depends(get_current_user),
    _member: Member = Depends(require_role(MemberRole.EDITOR)),
) -> AiFixApplyResult:
    """Apply an accepted subset of changes (also used for revert, with the value set to the
    original 'current')."""
    applied: list[str] = []
    updated_feature_ids: list[int] = []
    updated_milestone_ids: list[int] = []

    for item in payload.changes:
        if item.target == "feature":
            feature = await Feature.get_or_none(id=item.entity_id, project_id=project_id)
            if feature is None:
                continue
            res = _feature_field(feature, item.field, item.value)
            if res is None:
                continue
            _cur, pv, _prop, label = res
            setattr(feature, item.field, pv)
            await feature.save()
            updated_feature_ids.append(feature.id)
            applied.append(f"{feature.title}: {label}")
            await audit.record(
                project_id=project_id,
                actor=current_user,
                action=AuditAction.UPDATE,
                entity_type=EntityType.FEATURE,
                entity_id=feature.id,
                summary=f"AI fix — {label}",
            )
        elif item.target == "milestone":
            milestone = await Milestone.get_or_none(id=item.entity_id, project_id=project_id)
            if milestone is None:
                continue
            res = _milestone_field(milestone, item.field, item.value)
            if res is None:
                continue
            _cur, pv, _prop, label = res
            setattr(milestone, item.field, pv)
            await milestone.save()
            updated_milestone_ids.append(milestone.id)
            applied.append(f"Milestone '{milestone.title}': {label}")
            await audit.record(
                project_id=project_id,
                actor=current_user,
                action=AuditAction.UPDATE,
                entity_type=EntityType.MILESTONE,
                entity_id=milestone.id,
                summary=f"AI fix — {label}",
            )

    return AiFixApplyResult(
        applied=applied,
        updated_feature_ids=updated_feature_ids,
        updated_milestone_ids=updated_milestone_ids,
    )
