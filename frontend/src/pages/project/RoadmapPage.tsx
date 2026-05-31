import { useState } from "react";
import { useParams } from "react-router-dom";
import { Download, Flag, Plus, ScanSearch, Sparkles } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GanttChart } from "@/components/roadmap/GanttChart";
import { ReviewPanel } from "@/components/roadmap/ReviewPanel";
import { AskPanel } from "@/components/roadmap/AskPanel";
import { FeatureModal } from "@/components/features/FeatureModal";
import { MilestoneFormDialog } from "@/components/features/MilestoneFormDialog";
import { downloadFeaturesCsv } from "@/api/export";
import { getErrorMessage } from "@/api/client";
import { useFeatures, useMilestones } from "@/hooks/queries";
import type { Feature, Milestone } from "@/types";

const LEGEND = [
  { label: "In progress", className: "bg-indigo-500" },
  { label: "Backlog", className: "bg-slate-300" },
  { label: "Done", className: "bg-emerald-500" },
];

type MilestoneDialog = { key: string; target: Milestone | null } | null;

export function RoadmapPage() {
  const { projectId } = useParams();
  const id = Number(projectId);
  const { data: features, isLoading: featuresLoading } = useFeatures(id);
  const { data: milestones, isLoading: milestonesLoading } = useMilestones(id);

  const [selected, setSelected] = useState<Feature | null>(null);
  const [msDialog, setMsDialog] = useState<MilestoneDialog>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);

  const isLoading = featuresLoading || milestonesLoading;
  const hasData = (features?.length ?? 0) > 0 || (milestones?.length ?? 0) > 0;

  async function handleExport() {
    try {
      await downloadFeaturesCsv(id);
    } catch (error) {
      toast.error(getErrorMessage(error, "Export failed"));
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Roadmap</h2>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {LEGEND.map((l) => (
              <span key={l.label} className="flex items-center gap-1.5">
                <span className={`size-3 rounded-sm ${l.className}`} />
                {l.label}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rotate-45 rounded-[2px] bg-indigo-500" />
              Milestone
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setReviewOpen(true)} data-testid="review-btn">
            <ScanSearch />
            Review
          </Button>
          <Button variant="outline" onClick={() => setAskOpen(true)} data-testid="ask-btn">
            <Sparkles />
            Ask AI
          </Button>
          <Button
            variant="outline"
            onClick={() => setMsDialog({ key: "new", target: null })}
            data-testid="new-milestone"
          >
            <Flag />
            New milestone
          </Button>
          <Button variant="outline" onClick={handleExport} data-testid="export-csv">
            <Download />
            Export CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : hasData ? (
        <GanttChart
          features={features ?? []}
          milestones={milestones ?? []}
          onFeatureClick={setSelected}
          onMilestoneClick={(m) => setMsDialog({ key: `edit-${m.id}`, target: m })}
        />
      ) : (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <Plus className="size-7 text-muted-foreground" />
          <div>
            <p className="font-medium">Nothing to plot yet</p>
            <p className="text-sm text-muted-foreground">
              Add features on the Board and milestones here to build the roadmap.
            </p>
          </div>
        </Card>
      )}

      {selected && (
        <FeatureModal projectId={id} feature={selected} onClose={() => setSelected(null)} />
      )}

      {msDialog && (
        <MilestoneFormDialog
          key={msDialog.key}
          projectId={id}
          open
          onOpenChange={(o) => !o && setMsDialog(null)}
          milestone={msDialog.target}
        />
      )}

      <ReviewPanel
        projectId={id}
        features={features ?? []}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onFeatureClick={(f) => {
          setReviewOpen(false);
          setSelected(f);
        }}
      />

      <AskPanel projectId={id} open={askOpen} onOpenChange={setAskOpen} />
    </div>
  );
}
