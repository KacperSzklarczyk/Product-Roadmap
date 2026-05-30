import { useMemo, useState } from "react";

import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { cn } from "@/lib/utils";
import type { Feature, FeatureStatus, Milestone, RoadmapBucket } from "@/types";

// ---- layout constants (px) ----
const LEFT_W = 104; // swimlane label column
const MSLABEL_H = 64; // rotated milestone labels band
const MONTH_H = 26; // month axis row
const ROW_H = 40; // one feature row
const BAR_H = 26;
const MIN_BAR_W = 40;
const PX_PER_DAY = 5; // ~150px / month

const BUCKETS: { key: RoadmapBucket; label: string }[] = [
  { key: "now", label: "Now" },
  { key: "next", label: "Next" },
  { key: "later", label: "Later" },
];

// Bar fill encodes status, reusing the app's hue families
// (indigo = primary/blue, emerald = green badge, slate = gray/muted).
const STATUS_BAR: Record<FeatureStatus, string> = {
  in_progress: "bg-indigo-500 text-white",
  done: "bg-emerald-500 text-white",
  backlog: "bg-slate-300 text-slate-700",
};
const STATUS_LABEL: Record<FeatureStatus, string> = {
  in_progress: "In progress",
  done: "Done",
  backlog: "Backlog",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ---- date helpers ----
const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);
const parseISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** effort (person-months) → bar duration in days, per the roadmap convention. */
function durationDays(effort: number): number {
  if (effort <= 0.25) return 7;
  if (effort <= 0.5) return 14;
  if (effort <= 1.0) return 30;
  if (effort <= 2.0) return 60;
  return 90;
}

interface PositionedBar {
  feature: Feature;
  rowIndex: number; // global row across all swimlanes
  left: number;
  width: number;
}

interface HoverState {
  feature: Feature;
  x: number;
  y: number;
}

export function GanttChart({
  features,
  milestones,
  onFeatureClick,
  onMilestoneClick,
}: {
  features: Feature[];
  milestones: Milestone[];
  onFeatureClick: (f: Feature) => void;
  onMilestoneClick?: (m: Milestone) => void;
}) {
  const [hover, setHover] = useState<HoverState | null>(null);

  const model = useMemo(() => {
    const today = startOfDay(new Date());

    // Group + sort features per bucket (highest RICE first).
    const byBucket = (key: RoadmapBucket) =>
      features
        .filter((f) => f.roadmap_bucket === key)
        .sort((a, b) => b.rice_score - a.rice_score);

    // Sequential bucket scheduling: Now starts today; Next after the last Now
    // bar ends; Later after the last Next bar ends. All bars in a bucket share
    // the bucket's start date (each on its own row).
    const scheduled: { feature: Feature; start: Date; end: Date; bucket: RoadmapBucket }[] = [];
    let cursor = today;
    for (const { key } of BUCKETS) {
      const items = byBucket(key);
      let bucketEnd = cursor;
      for (const f of items) {
        const start = cursor;
        const end = addDays(start, durationDays(f.effort));
        scheduled.push({ feature: f, start, end, bucket: key });
        if (end.getTime() > bucketEnd.getTime()) bucketEnd = end;
      }
      cursor = bucketEnd; // next bucket starts where this one ends
    }

    // Timeline bounds (month-aligned), spanning features + milestones.
    const ends = [
      ...scheduled.map((s) => s.end),
      ...milestones.map((m) => (m.due_date ? parseISO(m.due_date) : today)),
      addMonths(today, 1),
    ];
    const starts = [today, ...milestones.map((m) => (m.due_date ? parseISO(m.due_date) : today))];
    const timelineStart = startOfMonth(new Date(Math.min(...starts.map((d) => d.getTime()))));
    const timelineEnd = endOfMonth(new Date(Math.max(...ends.map((d) => d.getTime()))));
    const totalDays = Math.max(1, daysBetween(timelineStart, timelineEnd));
    const timelineWidth = totalDays * PX_PER_DAY;
    const xOf = (d: Date) => (daysBetween(timelineStart, d) / totalDays) * timelineWidth;

    // Month columns.
    const months: { label: string; left: number; width: number }[] = [];
    for (let m = startOfMonth(timelineStart); m <= timelineEnd; m = addMonths(m, 1)) {
      const next = addMonths(m, 1);
      const showYear = m.getMonth() === 0 || months.length === 0;
      months.push({
        label: showYear ? `${MONTHS[m.getMonth()]} ${m.getFullYear()}` : MONTHS[m.getMonth()],
        left: xOf(m),
        width: daysBetween(m, next) * PX_PER_DAY,
      });
    }

    // Swimlane bands + per-bucket row assignment.
    const bands: { key: RoadmapBucket; label: string; startRow: number; rows: number }[] = [];
    let rowCursor = 0;
    for (const { key, label } of BUCKETS) {
      const count = scheduled.filter((s) => s.bucket === key).length;
      const rows = Math.max(count, 1); // keep empty lanes visible
      bands.push({ key, label, startRow: rowCursor, rows });
      rowCursor += rows;
    }
    const totalRows = rowCursor;

    // Positioned bars (global row index).
    const bars: PositionedBar[] = [];
    for (const band of bands) {
      const items = scheduled.filter((s) => s.bucket === band.key);
      items.forEach((s, i) => {
        const left = xOf(s.start);
        const right = xOf(s.end);
        bars.push({
          feature: s.feature,
          rowIndex: band.startRow + i,
          left,
          width: Math.max(right - left, MIN_BAR_W),
        });
      });
    }

    const markers = milestones
      .filter((m) => m.due_date)
      .map((m) => ({ milestone: m, left: xOf(parseISO(m.due_date as string)) }));

    return { timelineWidth, months, bands, totalRows, bars, markers };
  }, [features, milestones]);

  const bodyHeight = model.totalRows * ROW_H;
  const innerWidth = LEFT_W + model.timelineWidth;

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <div className="relative" style={{ minWidth: innerWidth }}>
        <div className="flex">
          {/* ---- left swimlane label column ---- */}
          <div className="shrink-0" style={{ width: LEFT_W }}>
            <div style={{ height: MSLABEL_H + MONTH_H }} />
            {model.bands.map((b, i) => (
              <div
                key={b.key}
                className={cn(
                  "flex items-center px-4 text-sm font-medium text-foreground",
                  i > 0 && "border-t border-border",
                  i % 2 === 1 && "bg-muted/40",
                )}
                style={{ height: b.rows * ROW_H }}
              >
                {b.label}
              </div>
            ))}
          </div>

          {/* ---- timeline column ---- */}
          <div className="relative" style={{ width: model.timelineWidth }}>
            {/* milestone rotated labels */}
            <div className="relative" style={{ height: MSLABEL_H }}>
              {model.markers.map(({ milestone, left }) => (
                <div
                  key={`lbl-${milestone.id}`}
                  className="absolute bottom-1 origin-bottom-left -rotate-45 whitespace-nowrap text-[11px] font-medium text-muted-foreground"
                  style={{ left }}
                >
                  {milestone.title}
                </div>
              ))}
            </div>

            {/* month axis */}
            <div
              className="relative border-y border-border bg-muted/40"
              style={{ height: MONTH_H }}
            >
              {model.months.map((m, i) => (
                <div
                  key={i}
                  className="absolute top-0 flex h-full items-center border-l border-border px-2 text-xs text-muted-foreground"
                  style={{ left: m.left, width: m.width }}
                >
                  {m.label}
                </div>
              ))}
            </div>

            {/* chart body */}
            <div className="relative" style={{ height: bodyHeight }}>
              {/* swimlane band backgrounds + separators */}
              {model.bands.map((b, i) => (
                <div
                  key={`band-${b.key}`}
                  className={cn(
                    "absolute inset-x-0",
                    i > 0 && "border-t border-border",
                    i % 2 === 1 && "bg-muted/40",
                  )}
                  style={{ top: b.startRow * ROW_H, height: b.rows * ROW_H }}
                />
              ))}

              {/* month gridlines */}
              {model.months.map((m, i) => (
                <div
                  key={`grid-${i}`}
                  className="absolute top-0 border-l border-border/60"
                  style={{ left: m.left, height: bodyHeight }}
                />
              ))}

              {/* milestone full-height lines + diamonds */}
              {model.markers.map(({ milestone, left }) => (
                <div key={`ms-${milestone.id}`}>
                  <div
                    className="absolute top-0 border-l border-dashed border-indigo-400/70"
                    style={{ left, height: bodyHeight }}
                  />
                  <button
                    type="button"
                    aria-label={`Milestone: ${milestone.title}`}
                    onClick={() => onMilestoneClick?.(milestone)}
                    title={`${milestone.title}${milestone.due_date ? ` · ${milestone.due_date}` : ""}`}
                    className="absolute z-10 size-3 rotate-45 rounded-[2px] border border-white bg-indigo-500 shadow-sm transition-transform hover:scale-125"
                    style={{ left: left - 6, top: -6 }}
                  />
                </div>
              ))}

              {/* feature bars */}
              {model.bars.map((bar) => (
                <button
                  type="button"
                  key={bar.feature.id}
                  onClick={() => onFeatureClick(bar.feature)}
                  onMouseEnter={(e) =>
                    setHover({ feature: bar.feature, x: e.clientX, y: e.clientY })
                  }
                  onMouseMove={(e) =>
                    setHover({ feature: bar.feature, x: e.clientX, y: e.clientY })
                  }
                  onMouseLeave={() => setHover(null)}
                  data-testid="gantt-bar"
                  className={cn(
                    "absolute flex items-center gap-2 rounded-md px-2 text-xs font-medium shadow-sm ring-0 transition-all hover:shadow-md hover:ring-2 hover:ring-ring hover:ring-offset-1",
                    STATUS_BAR[bar.feature.status],
                  )}
                  style={{
                    left: bar.left,
                    width: bar.width,
                    top: bar.rowIndex * ROW_H + (ROW_H - BAR_H) / 2,
                    height: BAR_H,
                  }}
                >
                  <span className="flex-1 truncate text-left">{bar.feature.title}</span>
                  <span className="shrink-0 font-semibold tabular-nums opacity-90">
                    {bar.feature.rice_score}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* hover tooltip — fixed position escapes the scroll container's clipping */}
      {hover && (
        <div
          className="pointer-events-none fixed z-50 w-64 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg"
          style={{ left: Math.min(hover.x + 14, window.innerWidth - 270), top: hover.y + 14 }}
        >
          <p className="text-sm font-medium leading-snug">{hover.feature.title}</p>
          {hover.feature.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {hover.feature.description}
            </p>
          )}
          <div className="mt-2 flex items-center justify-between">
            <ConfidenceBadge confidence={hover.feature.confidence} />
            <span className="text-xs font-semibold text-primary">
              RICE {hover.feature.rice_score}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="capitalize">{STATUS_LABEL[hover.feature.status]}</span>
            <span>·</span>
            <span className="capitalize">{hover.feature.roadmap_bucket}</span>
          </div>
        </div>
      )}
    </div>
  );
}
