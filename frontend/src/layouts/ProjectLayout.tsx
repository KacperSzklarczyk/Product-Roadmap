import { useEffect } from "react";
import {
  NavLink,
  Outlet,
  useNavigate,
  useParams,
} from "react-router-dom";
import { ArrowLeft, KanbanSquare, Map, Settings2 } from "lucide-react";
import toast from "react-hot-toast";

import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useProject } from "@/hooks/queries";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "board", label: "Board", icon: KanbanSquare },
  { to: "roadmap", label: "Roadmap", icon: Map },
  { to: "settings", label: "Settings", icon: Settings2 },
];

export function ProjectLayout() {
  const { projectId } = useParams();
  const id = Number(projectId);
  const navigate = useNavigate();
  const { data: project, isLoading, isError } = useProject(id);

  useEffect(() => {
    if (isError) {
      toast.error("Project not found");
      navigate("/dashboard", { replace: true });
    }
  }, [isError, navigate]);

  return (
    <div className="min-h-screen bg-muted">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="size-5" />
          </button>
          {isLoading ? (
            <Skeleton className="h-6 w-48" />
          ) : (
            <h1 className="text-lg font-semibold">{project?.name}</h1>
          )}
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-4">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet context={{ projectId: id }} />
      </main>
    </div>
  );
}
