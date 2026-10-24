import type { CombatType } from "@sylve/game";
import { GameIcon } from "./game-icon";

export function statChange(value: number, baseValue?: number) {
  if (baseValue === undefined || value === baseValue) return "normal";
  return value > baseValue ? "buffed" : "debuffed";
}

/** Shared statistics for card overlays and battlefield creatures. */
export function StatBadge({
  kind,
  value,
  baseValue,
  wounded = false,
  combatType = "melee",
}: {
  kind: "attack" | "health";
  value: number;
  baseValue?: number;
  wounded?: boolean;
  combatType?: CombatType;
}) {
  return (
    <span
      className={`stat-badge ${kind} ${kind === "attack" ? combatType : ""} ${wounded ? "wounded" : ""}`}
      data-stat-change={baseValue === undefined ? undefined : statChange(value, baseValue)}
      aria-label={`${value} ${kind === "health" ? "points de vie" : "de puissance"}`}
      aria-description={baseValue === undefined ? undefined : `Valeur normale : ${baseValue}. Écart : ${value > baseValue ? "+" : ""}${value - baseValue}.`}
      title={`${kind === "health" ? "Vie" : "Puissance"}${baseValue === undefined ? "" : ` · valeur normale : ${baseValue}`}`}
    >
      <GameIcon kind={kind === "health" ? "health" : combatType} />
      <strong>{value}</strong>
    </span>
  );
}
