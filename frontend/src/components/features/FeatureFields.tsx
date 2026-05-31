import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  FeatureSpecialization,
  FeatureStatus,
  RoadmapBucket,
} from "@/types";

export interface FeatureFormValue {
  title: string;
  description: string;
  status: FeatureStatus;
  roadmap_bucket: RoadmapBucket;
  specialization: FeatureSpecialization | "none";
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
}

export const EMPTY_FEATURE: FeatureFormValue = {
  title: "",
  description: "",
  status: "backlog",
  roadmap_bucket: "later",
  specialization: "none",
  reach: 100,
  impact: 1,
  confidence: 50,
  effort: 1,
};

const SPECIALIZATION_OPTIONS: { value: FeatureSpecialization; label: string }[] = [
  { value: "frontend", label: "Frontend" },
  { value: "backend", label: "Backend" },
  { value: "devops", label: "DevOps" },
  { value: "integration", label: "Integration" },
  { value: "testing", label: "Testing" },
];

const IMPACT_OPTIONS = [
  { value: 0.25, label: "0.25 — Minimal" },
  { value: 0.5, label: "0.5 — Low" },
  { value: 1, label: "1 — Medium" },
  { value: 2, label: "2 — High" },
  { value: 3, label: "3 — Massive" },
];

export function riceScore(v: FeatureFormValue): number {
  if (!v.effort) return 0;
  return Math.round((v.reach * v.impact * (v.confidence / 100)) / v.effort * 100) / 100;
}

export function FeatureFields({
  value,
  onChange,
}: {
  value: FeatureFormValue;
  onChange: (next: FeatureFormValue) => void;
}) {
  const set = <K extends keyof FeatureFormValue>(
    key: K,
    v: FeatureFormValue[K],
  ) => onChange({ ...value, [key]: v });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="f-title">Title</Label>
        <Input
          id="f-title"
          required
          value={value.title}
          onChange={(e) => set("title", e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="f-desc">Description</Label>
        <Textarea
          id="f-desc"
          value={value.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label>Status</Label>
          <Select
            value={value.status}
            onValueChange={(v) => set("status", v as FeatureStatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="backlog">Backlog</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Roadmap bucket</Label>
          <Select
            value={value.roadmap_bucket}
            onValueChange={(v) => set("roadmap_bucket", v as RoadmapBucket)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="now">Now</SelectItem>
              <SelectItem value="next">Next</SelectItem>
              <SelectItem value="later">Later</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label>Specialization</Label>
        <Select
          value={value.specialization}
          onValueChange={(v) => set("specialization", v as FeatureSpecialization | "none")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Unspecified —</SelectItem>
            {SPECIALIZATION_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Attributes this feature's effort to a discipline so the AI can plan sprint capacity.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="f-reach">Reach (per quarter)</Label>
          <Input
            id="f-reach"
            type="number"
            min={0}
            value={value.reach}
            onChange={(e) => set("reach", Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Impact</Label>
          <Select
            value={String(value.impact)}
            onValueChange={(v) => set("impact", Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMPACT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="f-conf">Confidence (%)</Label>
          <Input
            id="f-conf"
            type="number"
            min={0}
            max={100}
            value={value.confidence}
            onChange={(e) => set("confidence", Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="f-effort">Effort (person-months)</Label>
          <Input
            id="f-effort"
            type="number"
            min={0.1}
            step={0.1}
            value={value.effort}
            onChange={(e) => set("effort", Number(e.target.value))}
          />
        </div>
      </div>
      <div className="flex items-center justify-between rounded-md bg-secondary px-3 py-2 text-sm">
        <span className="text-muted-foreground">RICE score</span>
        <span className="font-semibold text-primary" data-testid="rice-preview">
          {riceScore(value)}
        </span>
      </div>
    </div>
  );
}
