import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateMilestone,
  useDeleteMilestone,
  useUpdateMilestone,
} from "@/hooks/queries";
import type { Milestone, MilestoneStatus } from "@/types";

export function MilestoneFormDialog({
  projectId,
  open,
  onOpenChange,
  milestone,
}: {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestone?: Milestone | null;
}) {
  const isEditing = !!milestone;
  const createMilestone = useCreateMilestone(projectId);
  const updateMilestone = useUpdateMilestone(projectId);
  const deleteMilestone = useDeleteMilestone(projectId);

  const [title, setTitle] = useState(milestone?.title ?? "");
  const [description, setDescription] = useState(milestone?.description ?? "");
  const [dueDate, setDueDate] = useState(milestone?.due_date ?? "");
  const [status, setStatus] = useState<MilestoneStatus>(milestone?.status ?? "planned");

  const saving = createMilestone.isPending || updateMilestone.isPending;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      title,
      description: description || null,
      due_date: dueDate || null,
      status,
    };
    const onSuccess = () => onOpenChange(false);
    if (isEditing && milestone) {
      updateMilestone.mutate({ milestoneId: milestone.id, payload }, { onSuccess });
    } else {
      createMilestone.mutate(payload, { onSuccess });
    }
  }

  function handleDelete() {
    if (!milestone) return;
    if (!confirm("Delete this milestone?")) return;
    deleteMilestone.mutate(milestone.id, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit milestone" : "New milestone"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="m-title">Title</Label>
            <Input
              id="m-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="m-desc">Description</Label>
            <Textarea
              id="m-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="m-due">Due date</Label>
              <Input
                id="m-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as MilestoneStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            {isEditing ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteMilestone.isPending}
              >
                <Trash2 />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={saving}>
              {saving
                ? isEditing
                  ? "Saving…"
                  : "Creating…"
                : isEditing
                  ? "Save changes"
                  : "Create milestone"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
