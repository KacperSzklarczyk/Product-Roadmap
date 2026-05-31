import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  FeatureFields,
  type FeatureFormValue,
} from "@/components/features/FeatureFields";
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useDeleteFeature,
  useUpdateFeature,
} from "@/hooks/queries";
import { useAuthStore } from "@/store/auth";
import type { Feature } from "@/types";

function featureToForm(f: Feature): FeatureFormValue {
  return {
    title: f.title,
    description: f.description ?? "",
    status: f.status,
    roadmap_bucket: f.roadmap_bucket,
    specialization: f.specialization ?? "none",
    reach: f.reach,
    impact: f.impact,
    confidence: f.confidence,
    effort: f.effort,
  };
}

export function FeatureModal({
  projectId,
  feature,
  onClose,
}: {
  projectId: number;
  feature: Feature;
  onClose: () => void;
}) {
  const [value, setValue] = useState<FeatureFormValue>(featureToForm(feature));
  const currentUser = useAuthStore((s) => s.user);

  const updateFeature = useUpdateFeature(projectId);
  const deleteFeature = useDeleteFeature(projectId);
  const { data: comments } = useComments(projectId, "feature", feature.id);
  const createComment = useCreateComment(projectId, "feature", feature.id);
  const deleteComment = useDeleteComment(projectId, "feature", feature.id);
  const [commentBody, setCommentBody] = useState("");

  function handleSave() {
    updateFeature.mutate(
      {
        featureId: feature.id,
        payload: {
          title: value.title,
          description: value.description || null,
          status: value.status,
          roadmap_bucket: value.roadmap_bucket,
          specialization: value.specialization === "none" ? null : value.specialization,
          reach: value.reach,
          impact: value.impact,
          confidence: value.confidence,
          effort: value.effort,
        },
      },
      { onSuccess: onClose },
    );
  }

  function handleDelete() {
    if (!confirm("Delete this feature?")) return;
    deleteFeature.mutate(feature.id, { onSuccess: onClose });
  }

  function handleComment(e: FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    createComment.mutate(commentBody, { onSuccess: () => setCommentBody("") });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit feature</DialogTitle>
        </DialogHeader>

        <FeatureFields value={value} onChange={setValue} />

        <div className="flex items-center justify-between border-t border-border pt-4">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleteFeature.isPending}
          >
            <Trash2 />
            Delete
          </Button>
          <Button onClick={handleSave} disabled={updateFeature.isPending}>
            {updateFeature.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>

        <div className="border-t border-border pt-4">
          <h4 className="mb-3 text-sm font-semibold">Comments</h4>
          <div className="mb-3 flex flex-col gap-3">
            {comments && comments.length > 0 ? (
              comments.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-2 text-sm">
                  <div>
                    <span className="font-medium">
                      {c.author.full_name ?? c.author.email}
                    </span>
                    <p className="text-muted-foreground">{c.body}</p>
                  </div>
                  {c.author.id === currentUser?.id && (
                    <button
                      onClick={() => deleteComment.mutate(c.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Delete comment"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            )}
          </div>
          <form onSubmit={handleComment} className="flex gap-2">
            <Input
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Add a comment…"
              data-testid="comment-input"
            />
            <Button type="submit" disabled={createComment.isPending}>
              Post
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
