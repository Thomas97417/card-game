import { useLayoutEffect, useState, type RefObject } from "react";
import { DEPTHS, ROWS, isDeploymentDepth, type CardDefinition } from "@sylve/game";
import { projectCellPoint, projectedUnitSize, ARENA_HEIGHT } from "./arena-layout";
import { CreaturePortrait } from "./creature-portrait";

export function BattleDragPreview({ card, x, y, hovered, room }: {
  card: CardDefinition;
  x: number;
  y: number;
  hovered: string | null;
  room: RefObject<HTMLElement | null>;
}) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const arena = room.current?.querySelector<HTMLElement>(".arena");
    if (!arena) return;
    const measure = () => {
      const bounds = arena.getBoundingClientRect();
      let [row, depth] = hovered?.split("-").map(Number) ?? [];
      depth ??= Array.from({ length: DEPTHS }, (_, depth) => depth).find((depth) => isDeploymentDepth(card, depth)) ?? 0;
      if (row === undefined) {
        row = Array.from({ length: ROWS }, (_, row) => row).reduce((best, candidate) => {
          const distance = (row: number) => Math.abs(bounds.top + projectCellPoint(row, DEPTHS - 1 - depth!, 0.5, 0.5).y / ARENA_HEIGHT * bounds.height - y);
          return distance(candidate) < distance(best) ? candidate : best;
        }, 0);
      }
      const next = projectedUnitSize(bounds.width, row, DEPTHS - 1 - depth);
      setSize((previous) => previous?.width === next.width && previous.height === next.height ? previous : next);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(arena);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [card, hovered, room, y]);
  return (
    <div className="drag-preview" style={{ left: x, top: y, ...size, visibility: size ? "visible" : "hidden" }} aria-hidden="true">
      <CreaturePortrait card={card} />
    </div>
  );
}
