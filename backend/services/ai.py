"""AI feature extraction via the Anthropic API.

Takes a freeform transcript and returns structured feature drafts using a forced
tool call (structured output). The system prompt is prompt-cached. Nothing is
persisted here — the caller reviews/edits drafts and creates features normally.
"""

from datetime import date

from anthropic import AsyncAnthropic

from config import settings
from models import (
    AuditLog,
    Feature,
    FeatureStatus,
    Milestone,
    MilestoneStatus,
    RoadmapBucket,
)
from schemas import FeatureDraft, Finding

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


# ---------------------------------------------------------------------------
# Roadmap review + ask (analysis over the project's own data)
# ---------------------------------------------------------------------------
def _roadmap_context(
    features: list[Feature],
    milestones: list[Milestone],
    activity: list[AuditLog],
) -> str:
    """Render the project's roadmap as compact text for the model to reason over."""
    lines = [f"Today's date: {date.today().isoformat()}.", "", "## Features (sorted by RICE, highest first)"]
    if not features:
        lines.append("(none)")
    for f in sorted(features, key=lambda x: x.rice_score, reverse=True):
        desc = f" — {f.description}" if f.description else ""
        lines.append(
            f"[{f.id}] {f.title} | bucket={f.roadmap_bucket.value} | status={f.status.value} | "
            f"reach={f.reach} | impact={f.impact} | confidence={f.confidence}% | "
            f"effort={f.effort}pm | RICE={f.rice_score}{desc}"
        )

    lines += ["", "## Milestones"]
    if not milestones:
        lines.append("(none)")
    for m in sorted(milestones, key=lambda x: x.due_date or date.max):
        lines.append(
            f"{m.title} | due={m.due_date.isoformat() if m.due_date else 'unset'} | status={m.status.value}"
        )

    lines += ["", "## Recent activity (newest first)"]
    if not activity:
        lines.append("(none)")
    for a in activity:
        lines.append(
            f"{a.created_at.date().isoformat()} | {a.actor.email} | "
            f"{a.action.value} {a.entity_type.value} | {a.summary or ''}"
        )
    return "\n".join(lines)


REVIEW_SYSTEM = """You are a senior product-operations reviewer auditing a product roadmap for a
team that builds GenAI tools for auditors. Audit the roadmap data the user sends and surface
concrete FINDINGS, the way an auditor would. Look specifically for:
- Overloaded "Now" bucket: too much summed effort (person-months) to realistically ship soon.
- Risky bets: high RICE score but low confidence (< 50%).
- Milestone feasibility: given today's date and milestone due dates, whether the summed effort of
  the relevant in-flight work can plausibly fit before the milestone.
- Status/priority mismatches: high-RICE items stuck in backlog; items marked done still in "now".
- Thin scope: high-impact features with no description.

For each finding provide: severity (high | medium | low), a short title, a one-to-two sentence
rationale that cites specific numbers, RICE scores, person-months, or dates from the data, and the
feature_ids it concerns (empty array for roadmap-wide findings). Order findings by severity
(high first). Be specific and grounded — never invent features or numbers. If the roadmap is
genuinely healthy, return few or no findings. Call emit_findings exactly once."""

REVIEW_TOOL = {
    "name": "emit_findings",
    "description": "Emit the ranked list of roadmap review findings.",
    "input_schema": {
        "type": "object",
        "properties": {
            "findings": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "severity": {"type": "string", "enum": ["high", "medium", "low"]},
                        "title": {"type": "string"},
                        "rationale": {"type": "string"},
                        "feature_ids": {"type": "array", "items": {"type": "integer"}},
                    },
                    "required": ["severity", "title", "rationale", "feature_ids"],
                },
            }
        },
        "required": ["findings"],
    },
}

_SEVERITY_RANK = {"high": 0, "medium": 1, "low": 2}


async def review_roadmap(
    features: list[Feature],
    milestones: list[Milestone],
    activity: list[AuditLog],
) -> list[Finding]:
    client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    response = await client.messages.create(
        model=settings.AI_MODEL,
        max_tokens=2048,
        system=[{"type": "text", "text": REVIEW_SYSTEM, "cache_control": {"type": "ephemeral"}}],
        tools=[REVIEW_TOOL],
        tool_choice={"type": "tool", "name": "emit_findings"},
        messages=[{"role": "user", "content": _roadmap_context(features, milestones, activity)}],
    )
    valid_ids = {f.id for f in features}
    findings: list[Finding] = []
    for block in response.content:
        if block.type == "tool_use" and block.name == "emit_findings":
            for raw in block.input.get("findings", []):
                sev = raw.get("severity", "medium")
                if sev not in _SEVERITY_RANK:
                    sev = "medium"
                ids = [int(x) for x in raw.get("feature_ids", []) if int(x) in valid_ids]
                findings.append(
                    Finding(
                        severity=sev,
                        title=str(raw.get("title", "")).strip()[:200] or "Finding",
                        rationale=str(raw.get("rationale", "")).strip(),
                        feature_ids=ids,
                    )
                )
    findings.sort(key=lambda f: _SEVERITY_RANK[f.severity])
    return findings


ASK_SYSTEM = """You are a roadmap analyst assistant for a team building GenAI tools for auditors.
Answer the user's question about THIS roadmap using only the data provided below. Be concise and
specific: reference features by title; cite RICE scores, effort (person-months), confidence,
buckets, and milestone due dates; use the recent activity log when asked what changed. When asked
what to cut or prioritize, reason explicitly with RICE (value) versus effort (cost) and the
milestone dates. If the data does not contain the answer, say so briefly. Never invent features or
numbers.

You MUST call answer_question exactly once. Build its fields like this:

answer: Start with "TL;DR: " followed by EXACTLY two sentences that are direct, decisive, and
immediately actionable — the punchline a busy PM needs first. Then a blank line, then the detailed
recommendations / reasoning. Respond in plain text only — short paragraphs and simple "- " bullet
lists. Do NOT use Markdown headings (#), bold (**), or backticks; write feature names as plain text.

follow_ups: exactly 3 questions that drill DEEPER into the SAME topic the user just asked about
(the natural next things they'd want to know to act on this answer).

other_topics: exactly 3 questions about DIFFERENT aspects of this roadmap not covered by the
current answer — e.g. capacity/overload, risky bets, milestone feasibility, recent activity,
sequencing, or what to cut.

Every suggested question must be phrased in the first person as the user would type it, be specific
to THIS roadmap's data, stay under ~70 characters, and carry no numbering or quotes."""

ANSWER_TOOL = {
    "name": "answer_question",
    "description": "Return the roadmap answer plus suggested follow-up questions.",
    "input_schema": {
        "type": "object",
        "properties": {
            "answer": {"type": "string"},
            "follow_ups": {"type": "array", "items": {"type": "string"}},
            "other_topics": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["answer", "follow_ups", "other_topics"],
    },
}


def _clean_questions(raw: object) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for item in raw:
        q = str(item).strip()
        if q:
            out.append(q[:120])
    return out[:3]


async def ask_roadmap(
    question: str,
    features: list[Feature],
    milestones: list[Milestone],
    activity: list[AuditLog],
) -> dict:
    client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    context = _roadmap_context(features, milestones, activity)
    response = await client.messages.create(
        model=settings.AI_MODEL,
        max_tokens=1400,
        system=[
            {"type": "text", "text": ASK_SYSTEM, "cache_control": {"type": "ephemeral"}},
            {"type": "text", "text": f"ROADMAP DATA:\n{context}", "cache_control": {"type": "ephemeral"}},
        ],
        tools=[ANSWER_TOOL],
        tool_choice={"type": "tool", "name": "answer_question"},
        messages=[{"role": "user", "content": question}],
    )
    for block in response.content:
        if block.type == "tool_use" and block.name == "answer_question":
            answer = str(block.input.get("answer", "")).strip()
            return {
                "answer": answer or "I couldn't generate an answer from the current roadmap data.",
                "follow_ups": _clean_questions(block.input.get("follow_ups")),
                "other_topics": _clean_questions(block.input.get("other_topics")),
            }
    return {
        "answer": "I couldn't generate an answer from the current roadmap data.",
        "follow_ups": [],
        "other_topics": [],
    }


FIX_SYSTEM = """You resolve a SINGLE product-roadmap finding by proposing concrete edits to
features and milestones. You are given the finding and the full current roadmap. Decide the
minimal set of changes that genuinely resolves the finding, then call apply_fix exactly once.

You may change these feature fields: roadmap_bucket (now/next/later), status
(backlog/in_progress/done), reach (int), impact (one of 0.25, 0.5, 1, 2, 3), confidence (0-100),
effort (>0 person-months). And these milestone fields: due_date (YYYY-MM-DD), status
(planned/in_progress/completed).

Resolution guidance by finding type:
- Overloaded "now" bucket: move the lowest-RICE and/or lowest-confidence "now" features to "next"
  (or "later") until the remaining now effort is realistic for one short sprint window. Prefer
  moving backlog items before in_progress ones.
- A "done" feature still sitting in the "now" bucket: move it to "next" so the active board
  reflects reality.
- Risky bet (high RICE but low confidence): move it to a later bucket to de-risk the near-term
  plan. Do not fabricate higher confidence.
- Milestone not feasible by its due date: either push the milestone due_date out to a realistic
  date given the summed effort, OR move non-essential features out of the bucket feeding it.
  Choose the least disruptive option.
- Status/priority mismatch (high-RICE item stuck in backlog while in "now"): set status to
  in_progress, or move the bucket, whichever the finding implies.
- Thin scope / missing description: NOT fixable by these field edits — return empty updates.

Only set fields you are actually changing (omit unchanged ones). Make the smallest change that
resolves the finding. Only use feature_ids and milestone_ids that appear in the roadmap. Provide a
concise, human-readable summary of what you did."""

_FEATURE_UPDATE_SCHEMA = {
    "type": "object",
    "properties": {
        "feature_id": {"type": "integer"},
        "roadmap_bucket": {"type": "string", "enum": [b.value for b in RoadmapBucket]},
        "status": {"type": "string", "enum": [s.value for s in FeatureStatus]},
        "reach": {"type": "integer"},
        "impact": {"type": "number", "enum": ALLOWED_IMPACT},
        "confidence": {"type": "integer"},
        "effort": {"type": "number"},
    },
    "required": ["feature_id"],
}
_MILESTONE_UPDATE_SCHEMA = {
    "type": "object",
    "properties": {
        "milestone_id": {"type": "integer"},
        "due_date": {"type": "string"},
        "status": {"type": "string", "enum": [s.value for s in MilestoneStatus]},
    },
    "required": ["milestone_id"],
}

APPLY_FIX_TOOL = {
    "name": "apply_fix",
    "description": "Apply the concrete feature/milestone edits that resolve the finding.",
    "input_schema": {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "feature_updates": {"type": "array", "items": _FEATURE_UPDATE_SCHEMA},
            "milestone_updates": {"type": "array", "items": _MILESTONE_UPDATE_SCHEMA},
        },
        "required": ["summary", "feature_updates", "milestone_updates"],
    },
}


async def fix_finding(
    finding: Finding,
    features: list[Feature],
    milestones: list[Milestone],
) -> dict:
    """Ask the model for a structured plan of edits that resolve the finding.

    Returns the raw tool input ({summary, feature_updates, milestone_updates}); the
    caller validates and applies it to the database.
    """
    client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    context = _roadmap_context(features, milestones, [])
    user = (
        "FINDING TO RESOLVE:\n"
        f"severity: {finding.severity}\n"
        f"title: {finding.title}\n"
        f"rationale: {finding.rationale}\n"
        f"related feature_ids: {finding.feature_ids}\n\n"
        f"CURRENT ROADMAP:\n{context}"
    )
    response = await client.messages.create(
        model=settings.AI_MODEL,
        max_tokens=1500,
        system=[{"type": "text", "text": FIX_SYSTEM, "cache_control": {"type": "ephemeral"}}],
        tools=[APPLY_FIX_TOOL],
        tool_choice={"type": "tool", "name": "apply_fix"},
        messages=[{"role": "user", "content": user}],
    )
    for block in response.content:
        if block.type == "tool_use" and block.name == "apply_fix":
            return block.input
    return {"summary": "No changes proposed.", "feature_updates": [], "milestone_updates": []}
