"""AI feature extraction via the Anthropic API.

Takes a freeform transcript and returns structured feature drafts using a forced
tool call (structured output). The system prompt is prompt-cached. Nothing is
persisted here — the caller reviews/edits drafts and creates features normally.
"""

from anthropic import AsyncAnthropic

from config import settings
from models import FeatureStatus, RoadmapBucket
from schemas import FeatureDraft

ALLOWED_IMPACT = [0.25, 0.5, 1.0, 2.0, 3.0]

SYSTEM_PROMPT = """You are a product operations assistant for a roadmap planning tool.
You convert a freeform transcript (someone talking through product functionality) into
discrete, well-scoped product features.

For each distinct feature you identify, produce:
- title: a short imperative name (e.g. "Bulk CSV export")
- description: 1-3 sentences capturing intent, scope, and any stated constraints
- status: one of backlog / in_progress / done (default backlog unless the speaker says it's underway or shipped)
- roadmap_bucket: one of now / next / later (infer urgency from the transcript; default later)
- reach: estimated users/events affected per quarter (integer; estimate conservatively, 0 if unknown)
- impact: one of 0.25 (minimal), 0.5 (low), 1 (medium), 2 (high), 3 (massive)
- confidence: your confidence in these estimates as a percentage 0-100
- effort: rough person-months (float, > 0; 1.0 if unsure)

Split the transcript into multiple features when it clearly covers several distinct
pieces of functionality. Do not invent features that aren't grounded in the text.
Call the emit_features tool exactly once with all features."""

_FEATURE_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "description": {"type": "string"},
        "status": {"type": "string", "enum": [s.value for s in FeatureStatus]},
        "roadmap_bucket": {"type": "string", "enum": [b.value for b in RoadmapBucket]},
        "reach": {"type": "integer"},
        "impact": {"type": "number", "enum": ALLOWED_IMPACT},
        "confidence": {"type": "integer"},
        "effort": {"type": "number"},
    },
    "required": [
        "title",
        "status",
        "roadmap_bucket",
        "reach",
        "impact",
        "confidence",
        "effort",
    ],
}

TOOL = {
    "name": "emit_features",
    "description": "Emit the structured list of product features extracted from the transcript.",
    "input_schema": {
        "type": "object",
        "properties": {
            "features": {"type": "array", "items": _FEATURE_ITEM_SCHEMA},
        },
        "required": ["features"],
    },
}


def _nearest_impact(value: float) -> float:
    return min(ALLOWED_IMPACT, key=lambda allowed: abs(allowed - value))


def _normalize(raw: dict) -> FeatureDraft:
    """Clamp AI output into the valid ranges the rest of the system expects."""
    return FeatureDraft(
        title=str(raw.get("title", "")).strip()[:255] or "Untitled feature",
        description=(raw.get("description") or None),
        status=raw.get("status", FeatureStatus.BACKLOG.value),
        roadmap_bucket=raw.get("roadmap_bucket", RoadmapBucket.LATER.value),
        reach=max(0, int(raw.get("reach", 0))),
        impact=_nearest_impact(float(raw.get("impact", 1.0))),
        confidence=min(100, max(0, int(raw.get("confidence", 50)))),
        effort=max(0.1, float(raw.get("effort", 1.0))),
    )


async def draft_features_from_text(text: str) -> list[FeatureDraft]:
    client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    response = await client.messages.create(
        model=settings.AI_MODEL,
        max_tokens=4096,
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        tools=[TOOL],
        tool_choice={"type": "tool", "name": "emit_features"},
        messages=[{"role": "user", "content": text}],
    )

    for block in response.content:
        if block.type == "tool_use" and block.name == "emit_features":
            features = block.input.get("features", [])
            return [_normalize(item) for item in features]
    return []
