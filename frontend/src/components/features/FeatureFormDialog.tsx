import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EMPTY_FEATURE,
  FeatureFields,
  type FeatureFormValue,
} from "@/components/features/FeatureFields";
import { useCreateFeature } from "@/hooks/queries";

export function FeatureFormDialog({
  projectId,
  open,
  onOpenChange,
  defaults,
}: {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults?: Partial<FeatureFormValue>;
}) {
  const [value, setValue] = useState<FeatureFormValue>({
    ...EMPTY_FEATURE,
    ...defaults,
  });
  const createFeature = useCreateFeature(projectId);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createFeature.mutate(
      {
        title: value.title,
        description: value.description || null,
        status: value.status,
        roadmap_bucket: value.roadmap_bucket,
        reach: value.reach,
        impact: value.impact,
        confidence: value.confidence,
        effort: value.effort,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setValue({ ...EMPTY_FEATURE, ...defaults });
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New feature</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FeatureFields value={value} onChange={setValue} />
          <DialogFooter>
            <Button type="submit" disabled={createFeature.isPending}>
              {createFeature.isPending ? "Creating…" : "Create feature"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
