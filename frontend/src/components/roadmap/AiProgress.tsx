import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

/**
 * A staged progress checklist shown while a slow AI request is in flight.
 * It advances through `steps` on a fixed interval and holds on the last step
 * until the request resolves (the parent simply unmounts it). This keeps the
 * user engaged without claiming false precision.
 */
export function AiProgress({
  steps,
  intervalMs = 1200,
}: {
  steps: string[];
  intervalMs?: number;
}) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    // Advance up to (but not past) the final step; hold there until unmount.
    if (active >= steps.length - 1) return;
    const t = setTimeout(() => setActive((i) => i + 1), intervalMs);
    return () => clearTimeout(t);
  }, [active, steps.length, intervalMs]);

  const pct = Math.round(((active + 1) / steps.length) * 100);

  return (
    <div className="space-y-3" data-testid="ai-progress">
      <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="space-y-1.5">
        {steps.map((step, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <li
              key={step}
              className={
                "flex items-center gap-2 text-sm " +
                (done
                  ? "text-muted-foreground"
                  : current
                    ? "font-medium text-foreground"
                    : "text-muted-foreground/50")
              }
            >
              {done ? (
                <Check className="size-4 shrink-0 text-emerald-500" />
              ) : current ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
              ) : (
                <span className="size-4 shrink-0" />
              )}
              {step}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export const REVIEW_STEPS = [
  "Reading tasks and buckets",
  "Mapping effort to team capacity",
  "Checking milestone feasibility",
  "Evaluating risky bets & priorities",
  "Generating recommended fixes",
];

export const ASK_STEPS = [
  "Reading your roadmap",
  "Pulling the relevant features",
  "Reasoning about priorities & capacity",
  "Composing the answer",
];
