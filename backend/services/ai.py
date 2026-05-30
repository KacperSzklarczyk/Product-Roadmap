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

SYSTEM_PROMPT = """You are a product operations assistant helping a team that builds 
GenAI-powered web applications for auditors (document analysis, findings drafting, 
feedback processing). Your job is to convert a freeform spoken transcript into 
discrete, well-scoped product features ready for backlog entry.

## Extraction rules

SPLIT into separate features when:
- Two ideas have independent value and could ship in different sprints
- They affect different parts of the product or different user roles

MERGE into one feature when:
- One piece of functionality is only useful alongside another
- The speaker describes variations of the same underlying need

EXCLUDE if:
- The speaker is clearly speculating with no intent ("wouldn't it be funny if...")
- The idea is a duplicate of one already extracted
- The statement describes a problem only, with no feature implied

For hedged language ("maybe", "I'm not sure", "someone mentioned") — include the 
feature but set confidence below 50 and roadmap_bucket to later unless urgency 
is stated.

## Field definitions

title: short imperative phrase, max 8 words (e.g. "Bulk CSV export", 
"Highlight high-risk paragraphs on PDF")

description: 2-3 sentences. Cover: (1) what the feature does, (2) the user 
problem it solves, (3) any constraints or scope limits stated by the speaker. 
Do not invent constraints not grounded in the transcript.

status:
- backlog: default unless speaker says otherwise
- in_progress: speaker says it is underway or being built now
- done: speaker says it has shipped or is already live

roadmap_bucket:
- now: speaker signals urgency, blocking issue, or current sprint
- next: speaker signals planned but not immediate
- later: speaker is speculative, vague, or no timing given (default)

reach: integer. Estimate users or sessions affected per quarter.
Our product has approximately 500 active users per quarter — calibrate against 
this baseline. Use 0 only if the feature is explicitly admin-only or 
internal tooling with no user-facing surface.

impact:
- 0.25: cosmetic or minor convenience, affects edge cases
- 0.5: noticeable improvement to a secondary workflow
- 1.0: meaningful improvement to a common workflow
- 2.0: removes a significant blocker or trust barrier in a core workflow
- 3.0: unlocks an entirely new use case or user segment

confidence: integer 0-100. This is your confidence in the accuracy of your 
reach and impact estimates specifically — not in whether the feature is 
a good idea. Use 80+ only when the transcript gives explicit quantitative 
signals. Use 40-60 for typical inferred estimates. Use below 40 when 
you are extrapolating significantly.

effort: person-months as a float > 0. 
- 0.25: a few days (prompt change, copy update, minor UI tweak)
- 0.5: about one week (small self-contained feature)
- 1.0: two to three weeks (standard feature with backend + UI)
- 2.0: one to two months (significant new capability or integration)
- 3.0+: multi-month investment (new product surface, major infrastructure)
Use 1.0 if genuinely unknown.

## Output instruction
Call emit_features exactly once with all identified features as an array.
If the transcript contains no actionable features, call emit_features with 
an empty array. Do not add commentary outside the tool call."""

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
