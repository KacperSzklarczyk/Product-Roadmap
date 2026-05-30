import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Pencil, Plus, Trash2, Milestone as MilestoneIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCreateMilestone,
  useDeleteMilestone,
  useMilestones,
  useUpdateMilestone,
} from "@/hooks/queries";
import type { Milestone, MilestoneStatus } from "@/types";

const STATUS_VARIANT: Record<MilestoneStatus, "yellow" | "default" | "green"> = {
  planned: "yellow",
  in_progress: "default",
  completed: "green",
};

export function TimelinePage() {
  const { projectId } = useParams();
  const id = Number(projectId);
  const { data: milestones, isLoading } = useMilestones(id);
  const createMilestone = useCreateMilestone(id);
  const updateMilestone = useUpdateMilestone(id);
  const deleteMilestone = useDeleteMilestone(id);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<MilestoneStatus>("planned");

  const isEditing = editingId !== null;
  const saving = createMilestone.isPending || updateMilestone.isPending;

  function openCreate() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setDueDate("");
    setStatus("planned");
    setOpen(true);
  }

  function openEdit(m: Milestone) {
    setEditingId(m.id);
    setTitle(m.title);
    setDescription(m.description ?? "");
    setDueDate(m.due_date ?? "");
    setStatus(m.status);
    setOpen(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      title,
      description: description || null,
      due_date: dueDate || null,
      status,
    };
    const onSuccess = () => setOpen(false);
    if (isEditing) {
      updateMilestone.mutate({ milestoneId: editingId, payload }, { onSuccess });
    } else {
      createMilestone.mutate(payload, { onSuccess });
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Milestones</h2>
        <Button onClick={openCreate} data-testid="new-milestone">
          <Plus />
          New milestone
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : milestones && milestones.length > 0 ? (
        <ol className="relative ml-3 border-l border-border">
          {milestones.map((m) => (
            <li key={m.id} className="mb-5 ml-6" data-testid="milestone-row">
              <span className="absolute -left-2.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <MilestoneIcon className="size-3" />
              </span>
              <Card className="flex items-start justify-between p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{m.title}</p>
                    <Badge variant={STATUS_VARIANT[m.status]}>
                      {m.status.replace("_", " ")}
                    </Badge>
                  </div>
                  {m.due_date && (
                    <p className="text-xs text-muted-foreground">Due {m.due_date}</p>
                  )}
                  {m.description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {m.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(m)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Edit milestone"
                    data-testid="edit-milestone"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => deleteMilestone.mutate(m.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Delete milestone"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      ) : (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          No milestones yet.
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
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
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as MilestoneStatus)}
                >
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
            <DialogFooter>
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
    </div>
  );
}
