import { Card } from "@/components/ui/card";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import type { Feature } from "@/types";

interface FeatureCardProps {
  feature: Feature;
  onClick?: () => void;
  dragHandleProps?: Record<string, unknown>;
}

export function FeatureCard({ feature, onClick, dragHandleProps }: FeatureCardProps) {
  return (
    <Card
      className="cursor-pointer space-y-2 p-3 transition-shadow hover:shadow-md"
      onClick={onClick}
      data-testid="feature-card"
      {...dragHandleProps}
    >
      <p className="text-sm font-medium leading-snug">{feature.title}</p>
      {feature.description && (
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {feature.description}
        </p>
      )}
      {feature.specialization && (
        <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-secondary-foreground">
          {feature.specialization}
        </span>
      )}
      <div className="flex items-center justify-between pt-1">
        <ConfidenceBadge confidence={feature.confidence} />
        <span
          className="text-xs font-semibold text-primary"
          title="RICE score (reach × impact × confidence / effort)"
        >
          {feature.rice_score}
        </span>
      </div>
    </Card>
  );
}
