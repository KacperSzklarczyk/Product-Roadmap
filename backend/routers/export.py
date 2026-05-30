import csv
import io

from fastapi import APIRouter, Depends, Response

from deps import require_role
from models import Feature, Member, MemberRole

router = APIRouter(prefix="/projects/{project_id}/export", tags=["export"])

_COLUMNS = [
    "id",
    "title",
    "description",
    "status",
    "roadmap_bucket",
    "reach",
    "impact",
    "confidence",
    "effort",
    "rice_score",
    "position",
]


@router.get("/features.csv")
async def export_features_csv(
    project_id: int, _member: Member = Depends(require_role(MemberRole.VIEWER))
) -> Response:
    features = await Feature.filter(project_id=project_id).order_by("position", "id")

    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=_COLUMNS, extrasaction="ignore")
    writer.writeheader()
    for f in features:
        writer.writerow(
            {
                "id": f.id,
                "title": f.title,
                "description": f.description or "",
                "status": f.status.value,
                "roadmap_bucket": f.roadmap_bucket.value,
                "reach": f.reach,
                "impact": f.impact,
                "confidence": f.confidence,
                "effort": f.effort,
                "rice_score": f.rice_score,
                "position": f.position,
            }
        )

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="project_{project_id}_features.csv"'
        },
    )
