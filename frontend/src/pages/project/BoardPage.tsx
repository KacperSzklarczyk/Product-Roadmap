import { useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Plus, Sparkles, Tags } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FeatureBoard } from "@/components/features/FeatureBoard";
import { FeatureFormDialog } from "@/components/features/FeatureFormDialog";
import { FeatureModal } from "@/components/features/FeatureModal";
import { AiDraftDialog } from "@/components/features/AiDraftDialog";
import { TeamSprintPanel } from "@/components/planning/TeamSprintPanel";
import {
  useClassifySpecializations,
  useFeatures,
  useReorderFeatures,
} from "@/hooks/queries";
import type { Feature } from "@/types";

const COLUMNS = [
  { key: "backlog", label: "Backlog", sortByRice: true },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

export function BoardPage() {
  const { projectId } = useParams();
  const id = Number(projectId);
  const { data: features, isLoading } = useFeatures(id);
  const reorder = useReorderFeatures(id);
  const classify = useClassifySpecializations(id);
  const hasUnspecified = (features ?? []).some((f) => !f.specialization);

  const [createOpen, setCreateOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [selected, setSelected] = useState<Feature | null>(null);

  return (
    <div>
      <TeamSprintPanel projectId={id} />

      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Kanban board</h2>
        <div className="flex gap-2">
          {hasUnspecified && (
            <Button
              variant="outline"
              onClick={() => classify.mutate()}
              disabled={classify.isPending}
              data-testid="classify-btn"
            >
              {classify.isPending ? <Loader2 className="animate-spin" /> : <Tags />}
              {classify.isPending ? "Assigning…" : "Auto-assign specializations"}
            </Button>
          )}
          <Button variant="outline" onClick={() => setAiOpen(true)} data-testid="ai-button">
            <Sparkles />
            AI draft
          </Button>
          <Button onClick={() => setCreateOpen(true)} data-testid="new-feature">
            <Plus />
            New feature
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : (
        <FeatureBoard
          features={features ?? []}
          groupField="status"
          columns={COLUMNS}
          onReorder={(items) => reorder.mutate(items)}
          onCardClick={setSelected}
        />
      )}

      <FeatureFormDialog
        projectId={id}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      <AiDraftDialog projectId={id} open={aiOpen} onOpenChange={setAiOpen} />
      {selected && (
        <FeatureModal
          projectId={id}
          feature={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
