import { BowArrow, Heart, Sword } from "lucide-react";
import type { CombatType } from "@sylve/game";

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
  const Icon = kind === "health" ? Heart : combatType === "ranged" ? BowArrow : Sword;
  return (
    <span
      className={`stat-badge ${kind} ${kind === "attack" ? combatType : ""} ${wounded ? "wounded" : ""}`}
      aria-label={`${value} ${kind === "health" ? "points de vie" : "de puissance"}`}
      title={kind === "health" ? "Vie" : "Puissance"}
    >
      <Icon aria-hidden="true" />
      <strong>{value}</strong>
    </span>
  );
}
