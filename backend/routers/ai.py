from fastapi import APIRouter, Depends, HTTPException, status

from config import settings
from deps import require_role
from models import AuditLog, Feature, Member, MemberRole, Milestone
from schemas import AiReviewResponse, AskRequest, AskResponse
from services import ai

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
