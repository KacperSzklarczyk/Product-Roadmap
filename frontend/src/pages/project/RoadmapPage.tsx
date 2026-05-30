import { useState } from "react";
import { useParams } from "react-router-dom";
import { Download } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FeatureBoard } from "@/components/features/FeatureBoard";
import { FeatureModal } from "@/components/features/FeatureModal";
import { downloadFeaturesCsv } from "@/api/export";
import { getErrorMessage } from "@/api/client";
import { useFeatures, useReorderFeatures } from "@/hooks/queries";
import type { Feature } from "@/types";

const COLUMNS = [
  { key: "now", label: "Now" },
  { key: "next", label: "Next" },
  { key: "later", label: "Later" },
];

export function RoadmapPage() {
  const { projectId } = useParams();
  const id = Number(projectId);
  const { data: features, isLoading } = useFeatures(id);
  const reorder = useReorderFeatures(id);
  const [selected, setSelected] = useState<Feature | null>(null);

  async function handleExport() {
    try {
      await downloadFeaturesCsv(id);
    } catch (error) {
      toast.error(getErrorMessage(error, "Export failed"));
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Now / Next / Later</h2>
        <Button variant="outline" onClick={handleExport} data-testid="export-csv">
          <Download />
          Export CSV
        </Button>
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
          groupField="roadmap_bucket"
          columns={COLUMNS}
          onReorder={(items) => reorder.mutate(items)}
          onCardClick={setSelected}
        />
      )}

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
