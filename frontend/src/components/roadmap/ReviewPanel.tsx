import { useEffect } from "react";
import { Loader2, ScanSearch, RefreshCw, CheckCircle2 } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useReviewRoadmap } from "@/hooks/queries";
import type { Feature, FindingSeverity } from "@/types";

const SEVERITY_VARIANT: Record<FindingSeverity, "red" | "yellow" | "secondary"> = {
  high: "red",
  medium: "yellow",
  low: "secondary",
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
  const { mutate, reset } = review;

  // Run the audit each time the panel opens; reset when it closes.
  useEffect(() => {
    if (open) mutate();
    else reset();
  }, [open, mutate, reset]);

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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Auditing the roadmap…
            </div>
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
              {findings.map((f, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-card p-3 shadow-sm"
                  data-testid="review-finding"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">{f.title}</p>
                    <Badge variant={SEVERITY_VARIANT[f.severity]} className="capitalize">
                      {f.severity}
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
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border p-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => mutate()}
            disabled={review.isPending}
          >
            <RefreshCw className={review.isPending ? "animate-spin" : ""} />
            Re-run review
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
