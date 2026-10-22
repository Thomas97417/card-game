import type { CombatType } from "@sylve/game";
import { GameIcon } from "./game-icon";

/** Shared statistics for card overlays and battlefield creatures. */
export function StatBadge({
  kind,
  value,
  wounded = false,
  combatType = "melee",
}: {
  kind: "attack" | "health";
  value: number;
  wounded?: boolean;
  combatType?: CombatType;
}) {
  return (
    <span
      className={`stat-badge ${kind} ${kind === "attack" ? combatType : ""} ${wounded ? "wounded" : ""}`}
      aria-label={`${value} ${kind === "health" ? "points de vie" : "de puissance"}`}
      title={kind === "health" ? "Vie" : "Puissance"}
    >
      <GameIcon kind={kind === "health" ? "health" : combatType} />
      <strong>{value}</strong>
    </span>
  );
}
