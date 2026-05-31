import { useEffect, useState } from "react";
import {
  Loader2,
  ScanSearch,
  RefreshCw,
  CheckCircle2,
  Wand2,
  Check,
  Undo2,
} from "lucide-react";
import toast from "react-hot-toast";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AiProgress, REVIEW_STEPS } from "@/components/roadmap/AiProgress";
import { useFixApply, useFixPreview, useReviewRoadmap } from "@/hooks/queries";
import type {
  Feature,
  Finding,
  FindingSeverity,
  FixApplyItem,
  FixChange,
} from "@/types";

const SEVERITY_VARIANT: Record<FindingSeverity, "red" | "yellow" | "secondary"> = {
  high: "red",
  medium: "yellow",
  low: "secondary",
};

type Phase =
  | "idle"
  | "previewing"
  | "review"
  | "implementing"
  | "implemented"
  | "reverting"
  | "reverted";

interface FixState {
  phase: Phase;
  summary: string;
  changes: FixChange[];
  accepted: string[]; // change ids the user has ticked
  applied: FixChange[]; // the changes actually applied (for revert)
}

const INITIAL: FixState = {
  phase: "idle",
  summary: "",
  changes: [],
  accepted: [],
  applied: [],
};

export function ReviewPanel({
  projectId,
  features,
  open,
  onOpenChange,
  onFeatureClick,
}: {
  projectId: number;
  features: Feature[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFeatureClick: (feature: Feature) => void;
}) {
  const review = useReviewRoadmap(projectId);
  const preview = useFixPreview(projectId);
  const apply = useFixApply(projectId);
  const { mutate } = review;

  // Persist results: only auto-run the first time the panel opens with no findings.
  useEffect(() => {
    if (open && !review.data && !review.isPending) mutate();
  }, [open, review.data, review.isPending, mutate]);

  const [fixes, setFixes] = useState<Record<number, FixState>>({});
  const [busyIdx, setBusyIdx] = useState<number | null>(null);

  const stateFor = (i: number): FixState => fixes[i] ?? INITIAL;
  const patch = (i: number, next: Partial<FixState>) =>
    setFixes((prev) => ({ ...prev, [i]: { ...stateFor(i), ...next } }));

  function regenerate() {
    setFixes({});
    setBusyIdx(null);
    mutate();
  }

  function startPreview(finding: Finding, i: number) {
    setBusyIdx(i);
    patch(i, { phase: "previewing" });
    preview.mutate(finding, {
      onSuccess: (res) => {
        setBusyIdx(null);
        patch(i, {
          phase: "review",
          summary: res.summary,
          changes: res.changes,
          accepted: res.changes.map((c) => c.id),
          applied: [],
        });
      },
      onError: () => {
        setBusyIdx(null);
        patch(i, { phase: "idle" });
      },
    });
  }

  function toggle(i: number, id: string) {
    const s = stateFor(i);
    const accepted = s.accepted.includes(id)
      ? s.accepted.filter((x) => x !== id)
      : [...s.accepted, id];
    patch(i, { accepted });
  }

  function implement(i: number) {
    const s = stateFor(i);
    const chosen = s.changes.filter((c) => s.accepted.includes(c.id));
    if (chosen.length === 0) {
      toast("Select at least one change to implement.");
      return;
    }
    const items: FixApplyItem[] = chosen.map((c) => ({
      target: c.target,
      entity_id: c.entity_id,
      field: c.field,
      value: c.proposed,
    }));
    setBusyIdx(i);
    patch(i, { phase: "implementing" });
    apply.mutate(items, {
      onSuccess: (res) => {
        setBusyIdx(null);
        patch(i, { phase: "implemented", applied: chosen });
        toast.success(
          res.applied.length
            ? `Implemented ${res.applied.length} change${res.applied.length > 1 ? "s" : ""}`
            : "No changes were applied",
        );
      },
      onError: () => {
        setBusyIdx(null);
        patch(i, { phase: "review" });
      },
    });
  }

  function revert(i: number) {
    const s = stateFor(i);
    // Inverse: set each applied field back to its original value.
    const items: FixApplyItem[] = s.applied.map((c) => ({
      target: c.target,
      entity_id: c.entity_id,
      field: c.field,
      value: c.current,
    }));
    if (items.length === 0) return;
    setBusyIdx(i);
    patch(i, { phase: "reverting" });
    apply.mutate(items, {
      onSuccess: () => {
        setBusyIdx(null);
        patch(i, { phase: "reverted" });
        toast.success("Reverted to the previous state");
      },
      onError: () => {
        setBusyIdx(null);
        patch(i, { phase: "implemented" });
      },
    });
  }

  const findings = review.data ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ScanSearch className="size-4 text-primary" />
            AI roadmap review
          </SheetTitle>
          <SheetDescription>
            An AI audit of priorities, capacity, and milestone feasibility.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5">
          {review.isPending ? (
            <AiProgress steps={REVIEW_STEPS} />
          ) : findings.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <CheckCircle2 className="size-7 text-emerald-500" />
              <p className="text-sm font-medium">No issues found</p>
              <p className="text-xs text-muted-foreground">
                The roadmap looks healthy — nothing flagged.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                {findings.length} finding{findings.length > 1 ? "s" : ""}, highest severity first.
              </p>
              {findings.map((f, i) => {
                const s = stateFor(i);
                const done = s.phase === "implemented";
                return (
                  <div
                    key={i}
                    className="rounded-xl border border-border bg-card p-3 shadow-sm"
                    data-testid="review-finding"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">{f.title}</p>
                      <Badge
                        variant={done ? "green" : SEVERITY_VARIANT[f.severity]}
                        className="shrink-0 capitalize"
                      >
                        {done ? "fixed" : f.severity}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{f.rationale}</p>

                    {f.feature_ids.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {f.feature_ids
                          .map((id) => features.find((feat) => feat.id === id))
                          .filter((feat): feat is Feature => Boolean(feat))
                          .map((feat) => (
                            <button
                              key={feat.id}
                              onClick={() => onFeatureClick(feat)}
                              className="rounded-full border border-border bg-secondary px-2 py-0.5 text-xs text-secondary-foreground hover:bg-accent hover:text-accent-foreground"
                            >
                              {feat.title}
                            </button>
                          ))}
                      </div>
                    )}

                    <FixSection
                      state={s}
                      busy={busyIdx !== null}
                      onStart={() => startPreview(f, i)}
                      onToggle={(id) => toggle(i, id)}
                      onImplement={() => implement(i)}
                      onRevert={() => revert(i)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border p-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={regenerate}
            disabled={review.isPending || busyIdx !== null}
          >
            <RefreshCw className={review.isPending ? "animate-spin" : ""} />
            Re-run review
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FixSection({
  state,
  busy,
  onStart,
  onToggle,
  onImplement,
  onRevert,
}: {
  state: FixState;
  busy: boolean;
  onStart: () => void;
  onToggle: (id: string) => void;
  onImplement: () => void;
  onRevert: () => void;
}) {
  const { phase, changes, accepted, summary } = state;

  if (phase === "idle" || phase === "previewing") {
    return (
      <div className="mt-3">
        <Button
          size="sm"
          variant="outline"
          onClick={onStart}
          disabled={busy}
          data-testid="fix-btn"
        >
          {phase === "previewing" ? <Loader2 className="animate-spin" /> : <Wand2 />}
          {phase === "previewing" ? "Analyzing…" : "Fix with AI"}
        </Button>
      </div>
    );
  }

  if (phase === "implemented" || phase === "reverting") {
    return (
      <div className="mt-3 space-y-2">
        <div className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <p className="font-medium">Implemented:</p>
          <ul className="mt-0.5 list-inside list-disc">
            {state.applied.map((c) => (
              <li key={c.id}>
                {c.entity_title}: {c.label}
              </li>
            ))}
          </ul>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onRevert}
          disabled={busy}
          data-testid="fix-revert"
        >
          {phase === "reverting" ? <Loader2 className="animate-spin" /> : <Undo2 />}
          {phase === "reverting" ? "Reverting…" : "Revert changes"}
        </Button>
      </div>
    );
  }

  if (phase === "reverted") {
    return (
      <div className="mt-3 space-y-2">
        <p className="text-xs text-muted-foreground">
          Reverted to the previous state.
        </p>
        <Button size="sm" variant="outline" onClick={onStart} disabled={busy} data-testid="fix-btn">
          <Wand2 />
          Fix with AI
        </Button>
      </div>
    );
  }

  // phase === "review" or "implementing": show proposed changes with checkboxes.
  if (changes.length === 0) {
    return (
      <div className="mt-3 rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">
        {summary || "No automatic changes are applicable for this finding."}
      </div>
    );
  }

  const implementing = phase === "implementing";
  return (
    <div className="mt-3 space-y-2">
      {summary && <p className="text-xs text-muted-foreground">{summary}</p>}
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Recommended changes — pick what to apply
      </p>
      <div className="space-y-1.5">
        {changes.map((c) => {
          const checked = accepted.includes(c.id);
          return (
            <label
              key={c.id}
              data-testid="fix-change"
              className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            >
              <input
                type="checkbox"
                className="mt-0.5 size-3.5 accent-primary"
                checked={checked}
                disabled={implementing}
                onChange={() => onToggle(c.id)}
              />
              <span>
                <span className="font-medium">{c.entity_title}</span> — {c.label}
              </span>
            </label>
          );
        })}
      </div>
      <Button
        size="sm"
        onClick={onImplement}
        disabled={busy || accepted.length === 0}
        data-testid="fix-implement"
      >
        {implementing ? <Loader2 className="animate-spin" /> : <Check />}
        {implementing
          ? "Implementing…"
          : `Implement ${accepted.length} change${accepted.length === 1 ? "" : "s"}`}
      </Button>
    </div>
  );
}
