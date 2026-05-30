import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Trash2, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAddMember,
  useDeleteProject,
  useMembers,
  useProject,
  useRemoveMember,
  useUpdateMemberRole,
  useUpdateProject,
} from "@/hooks/queries";
import type { MemberRole } from "@/types";

export function SettingsPage() {
  const { projectId } = useParams();
  const id = Number(projectId);
  const navigate = useNavigate();

  const { data: project } = useProject(id);
  const { data: members, isLoading } = useMembers(id);
  const addMember = useAddMember(id);
  const updateRole = useUpdateMemberRole(id);
  const removeMember = useRemoveMember(id);
  const updateProject = useUpdateProject(id);
  const deleteProject = useDeleteProject();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("editor");
  const [name, setName] = useState("");

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    addMember.mutate({ email, role }, { onSuccess: () => setEmail("") });
  }

  function handleRename(e: FormEvent) {
    e.preventDefault();
    updateProject.mutate({ name: name || project?.name });
  }

  function handleDeleteProject() {
    if (!confirm("Delete this project and all its data? This cannot be undone."))
      return;
    deleteProject.mutate(id, {
      onSuccess: () => navigate("/dashboard", { replace: true }),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Members</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="member-email">Add by email</Label>
              <Input
                id="member-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@example.com"
              />
            </div>
            <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={addMember.isPending} data-testid="add-member">
              <UserPlus />
              Add
            </Button>
          </form>

          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {members?.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between py-2"
                  data-testid="member-row"
                >
                  <span className="text-sm">{m.user.email}</span>
                  <div className="flex items-center gap-2">
                    <Select
                      value={m.role}
                      onValueChange={(v) =>
                        updateRole.mutate({ memberId: m.id, role: v as MemberRole })
                      }
                    >
                      <SelectTrigger className="h-8 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="owner">Owner</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      onClick={() => removeMember.mutate(m.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remove member"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Project</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handleRename} className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="project-name">Rename</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={project?.name}
              />
            </div>
            <Button type="submit" variant="outline" disabled={updateProject.isPending}>
              Save
            </Button>
          </form>
          <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <div>
              <p className="text-sm font-medium">Delete project</p>
              <p className="text-xs text-muted-foreground">
                Permanently removes the project and all its data.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteProject}
              disabled={deleteProject.isPending}
            >
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
