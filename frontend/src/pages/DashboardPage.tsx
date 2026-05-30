import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Map, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useCreateProject, useProjects } from "@/hooks/queries";
import { useLogout } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/auth";

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const navigate = useNavigate();
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    createProject.mutate(
      { name, description: description || null },
      {
        onSuccess: (project) => {
          setOpen(false);
          setName("");
          setDescription("");
          navigate(`/projects/${project.id}/board`);
        },
      },
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <header className="flex items-center justify-between border-b border-border bg-background px-6 py-4">
        <div className="flex items-center gap-2">
          <Map className="text-primary" />
          <span className="font-semibold">Product Roadmap</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground" data-testid="user-email">
            {user?.email}
          </span>
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut />
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Projects</h2>
            <p className="text-sm text-muted-foreground">
              Plan, prioritize, and ship your roadmap.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="new-project">
                <Plus />
                New project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New project</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Q3 Roadmap"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createProject.isPending}>
                    {createProject.isPending ? "Creating…" : "Create project"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => navigate(`/projects/${project.id}/board`)}
                data-testid="project-card"
              >
                <CardHeader>
                  <CardTitle className="text-lg">{project.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {project.description || "No description"}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="flex flex-col items-center gap-3 p-12 text-center">
            <Map className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No projects yet</p>
              <p className="text-sm text-muted-foreground">
                Create your first project to start planning.
              </p>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
