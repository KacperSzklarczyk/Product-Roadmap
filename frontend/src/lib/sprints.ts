import type { TeamComposition } from "@/types";

export interface SprintWindow {
  number: number;
  start: Date;
  end: Date;
}

/**
 * Derive the next 3 sprint windows from the team's sprint cadence
 * (start date + length in weeks), auto-chained back-to-back.
 * Returns [] when no start date is configured.
 */
export function deriveSprints(
  team: Pick<TeamComposition, "sprint_start_date" | "sprint_length_weeks"> | null | undefined,
  count = 3,
): SprintWindow[] {
  if (!team?.sprint_start_date) return [];
  const weeks = team.sprint_length_weeks || 2;
  const start = new Date(team.sprint_start_date + "T00:00:00");
  const days = weeks * 7;
  const windows: SprintWindow[] = [];
  for (let n = 0; n < count; n++) {
    const s = new Date(start);
    s.setDate(s.getDate() + days * n);
    const e = new Date(start);
    e.setDate(e.getDate() + days * (n + 1) - 1);
    windows.push({ number: n + 1, start: s, end: e });
  }
  return windows;
}

export function formatSprintRange(w: SprintWindow): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(w.start)} – ${fmt(w.end)}`;
}
