import { Badge } from "@/components/ui/badge";

/** Green ≥70, yellow 40–69, red <40 — the design's confidence pill. */
export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const variant = confidence >= 70 ? "green" : confidence >= 40 ? "yellow" : "red";
  return <Badge variant={variant}>{confidence}% confidence</Badge>;
}
