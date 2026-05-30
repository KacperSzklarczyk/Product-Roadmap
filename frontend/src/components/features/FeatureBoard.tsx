import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { FeatureCard } from "@/components/features/FeatureCard";
import type { Feature, FeatureReorderItem } from "@/types";

export interface BoardColumn {
  key: string;
  label: string;
}

interface FeatureBoardProps {
  features: Feature[];
  /** The Feature field used to group cards into columns. */
  groupField: "status" | "roadmap_bucket";
  columns: BoardColumn[];
  onReorder: (items: FeatureReorderItem[]) => void;
  onCardClick: (feature: Feature) => void;
}

function SortableFeature({
  feature,
  onClick,
}: {
  feature: Feature;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: feature.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <FeatureCard
        feature={feature}
        onClick={onClick}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function Column({
  column,
  features,
  onCardClick,
}: {
  column: BoardColumn;
  features: Feature[];
  onCardClick: (f: Feature) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column.key}` });
  return (
    <div className="flex w-full flex-col rounded-xl bg-secondary/60 p-3">
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold">{column.label}</h3>
        <span className="text-xs text-muted-foreground">{features.length}</span>
      </div>
      <SortableContext
        items={features.map((f) => f.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={`flex min-h-24 flex-1 flex-col gap-2 rounded-lg p-1 transition-colors ${
            isOver ? "bg-primary/5" : ""
          }`}
          data-testid={`column-${column.key}`}
        >
          {features.map((feature) => (
            <SortableFeature
              key={feature.id}
              feature={feature}
              onClick={() => onCardClick(feature)}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export function FeatureBoard({
  features,
  groupField,
  columns,
  onReorder,
  onCardClick,
}: FeatureBoardProps) {
  const [items, setItems] = useState<Feature[]>(features);
  useEffect(() => setItems(features), [features]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const grouped = useMemo(() => {
    const map: Record<string, Feature[]> = {};
    for (const col of columns) map[col.key] = [];
    for (const f of [...items].sort((a, b) => a.position - b.position)) {
      const key = f[groupField];
      (map[key] ??= []).push(f);
    }
    return map;
  }, [items, columns, groupField]);

  function columnOf(id: number): string | undefined {
    return items.find((f) => f.id === id)?.[groupField];
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = Number(active.id);
    const overId = String(over.id);

    const sourceCol = columnOf(activeId);
    let targetCol: string | undefined;
    let overIndex = -1;

    if (overId.startsWith("col:")) {
      targetCol = overId.slice(4);
    } else {
      const overFeatureId = Number(over.id);
      targetCol = columnOf(overFeatureId);
      overIndex = (grouped[targetCol ?? ""] ?? []).findIndex(
        (f) => f.id === overFeatureId,
      );
    }
    if (!sourceCol || !targetCol) return;
    if (sourceCol === targetCol && Number(active.id) === Number(over.id)) return;

    // Build the new arrangement.
    const next = structuredClone(grouped) as Record<string, Feature[]>;
    const moved = items.find((f) => f.id === activeId);
    if (!moved) return;
    next[sourceCol] = next[sourceCol].filter((f) => f.id !== activeId);
    const updatedMoved = { ...moved, [groupField]: targetCol } as Feature;
    const insertAt = overIndex >= 0 ? overIndex : next[targetCol].length;
    next[targetCol].splice(insertAt, 0, updatedMoved);

    // Flatten with recomputed positions per column.
    const flat: Feature[] = [];
    const reorderItems: FeatureReorderItem[] = [];
    for (const col of columns) {
      next[col.key]?.forEach((f, idx) => {
        const updated = { ...f, position: idx, [groupField]: col.key } as Feature;
        flat.push(updated);
        reorderItems.push({
          id: f.id,
          position: idx,
          [groupField]: col.key,
        } as FeatureReorderItem);
      });
    }
    setItems(flat); // optimistic
    onReorder(reorderItems);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {columns.map((col) => (
          <Column
            key={col.key}
            column={col}
            features={grouped[col.key] ?? []}
            onCardClick={onCardClick}
          />
        ))}
      </div>
    </DndContext>
  );
}
