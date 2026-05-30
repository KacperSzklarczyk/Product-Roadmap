import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { useAiDraft, useCreateFeature } from "@/hooks/queries";
import type { FeatureDraft } from "@/types";

export function AiDraftDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<FeatureDraft[]>([]);
  const aiDraft = useAiDraft(projectId);
  const createFeature = useCreateFeature(projectId);

  function handleExtract() {
    aiDraft.mutate(text, {
      onSuccess: (result) => {
        if (result.length === 0) {
          toast("No features found in that text.");
        }
        setDrafts(result);
      },
    });
  }

  function updateDraft(index: number, patch: Partial<FeatureDraft>) {
    setDrafts((d) => d.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));
  }

  function createDraft(index: number) {
    const d = drafts[index];
    createFeature.mutate(
      {
        title: d.title,
        description: d.description,
        status: d.status,
        roadmap_bucket: d.roadmap_bucket,
        reach: d.reach,
        impact: d.impact,
        confidence: d.confidence,
        effort: d.effort,
      },
      {
        onSuccess: () => setDrafts((arr) => arr.filter((_, i) => i !== index)),
      },
    );
  }

  function reset() {
    setText("");
    setDrafts([]);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Operationalize a description
          </DialogTitle>
          <DialogDescription>
            Paste a transcript or rough notes. The AI extracts structured feature
            drafts you can review, tweak, and create.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. We really need a way for users to export their roadmap to CSV, and separately a Slack integration that posts when a feature ships…"
          className="min-h-32"
          data-testid="ai-text"
        />
        <Button
          onClick={handleExtract}
          disabled={aiDraft.isPending || !text.trim()}
          data-testid="ai-extract"
        >
          {aiDraft.isPending && <Loader2 className="animate-spin" />}
          {aiDraft.isPending ? "Extracting…" : "Extract features"}
        </Button>

        {drafts.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <p className="text-sm font-medium">
              {drafts.length} draft{drafts.length > 1 ? "s" : ""} — review and create
            </p>
            {drafts.map((d, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-lg border border-border p-3"
                data-testid="ai-draft"
              >
                <Input
                  value={d.title}
                  onChange={(e) => updateDraft(i, { title: e.target.value })}
                />
                {d.description && (
                  <p className="text-xs text-muted-foreground">{d.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ConfidenceBadge confidence={d.confidence} />
                    <span>R{d.reach} · I{d.impact} · E{d.effort}</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => createDraft(i)}
                    disabled={createFeature.isPending}
                    data-testid="ai-create-draft"
                  >
                    Create
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
