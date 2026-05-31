import { useEffect, useState } from "react";
import { Save, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTeam, useUpdateTeam } from "@/hooks/queries";
import { deriveSprints, formatSprintRange } from "@/lib/sprints";
import type { TeamCompositionInput } from "@/types";

const ROLES: { key: keyof TeamCompositionInput; label: string }[] = [
  { key: "frontend_devs", label: "Frontend" },
  { key: "backend_devs", label: "Backend" },
  { key: "fullstack_devs", label: "Fullstack" },
  { key: "testers", label: "Testers" },
  { key: "devops", label: "DevOps" },
  { key: "integration_engineers", label: "Integration" },
];

const EMPTY: TeamCompositionInput = {
  frontend_devs: 0,
  backend_devs: 0,
  fullstack_devs: 0,
  testers: 0,
  devops: 0,
  integration_engineers: 0,
  sprint_length_weeks: 2,
  sprint_start_date: null,
};

export function TeamSprintPanel({ projectId }: { projectId: number }) {
  const { data: team } = useTeam(projectId);
  const update = useUpdateTeam(projectId);
  const [form, setForm] = useState<TeamCompositionInput>(EMPTY);

  useEffect(() => {
    if (team) {
      setForm({
        frontend_devs: team.frontend_devs,
        backend_devs: team.backend_devs,
        fullstack_devs: team.fullstack_devs,
        testers: team.testers,
        devops: team.devops,
        integration_engineers: team.integration_engineers,
        sprint_length_weeks: team.sprint_length_weeks,
        sprint_start_date: team.sprint_start_date,
      });
    }
  }, [team]);

  const setNum = (key: keyof TeamCompositionInput, v: number) =>
    setForm((f) => ({ ...f, [key]: Math.max(0, v || 0) }));

  const sprints = deriveSprints(
    { sprint_start_date: form.sprint_start_date, sprint_length_weeks: form.sprint_length_weeks },
    3,
  );

  return (
    <Card className="mb-5 p-4" data-testid="team-panel">
      <div className="mb-3 flex items-center gap-2">
        <Users className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">Team & sprints</h3>
        <span className="text-xs text-muted-foreground">
          Head-counts and sprint cadence feed the AI's capacity reasoning.
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {ROLES.map((r) => (
          <div key={r.key} className="flex flex-col gap-1">
            <Label htmlFor={`team-${r.key}`} className="text-xs">
              {r.label}
            </Label>
            <Input
              id={`team-${r.key}`}
              data-testid={`team-${r.key}`}
              type="number"
              min={0}
              value={form[r.key] as number}
              onChange={(e) => setNum(r.key, Number(e.target.value))}
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Sprint length</Label>
          <Select
            value={String(form.sprint_length_weeks)}
            onValueChange={(v) => setForm((f) => ({ ...f, sprint_length_weeks: Number(v) }))}
          >
            <SelectTrigger className="w-32" data-testid="sprint-length">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((w) => (
                <SelectItem key={w} value={String(w)}>
                  {w} week{w > 1 ? "s" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="sprint-start" className="text-xs">
            Sprint 1 start
          </Label>
          <Input
            id="sprint-start"
            data-testid="sprint-start"
            type="date"
            className="w-44"
            value={form.sprint_start_date ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, sprint_start_date: e.target.value || null }))
            }
          />
        </div>
        <Button
          onClick={() => update.mutate(form)}
          disabled={update.isPending}
          data-testid="team-save"
        >
          <Save />
          {update.isPending ? "Saving…" : "Save"}
        </Button>
      </div>

      {sprints.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" data-testid="sprint-preview">
          {sprints.map((s) => (
            <span
              key={s.number}
              className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
            >
              Sprint {s.number}: {formatSprintRange(s)}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
