import { Heart, Sword } from "lucide-react";

/** The value stays readable inside its symbol at card and battlefield sizes. */
export function StatBadge({
  kind,
  value,
  wounded = false,
}: {
  kind: "attack" | "health";
  value: number;
  wounded?: boolean;
}) {
  const Icon = kind === "health" ? Heart : Sword;
  return (
    <span
      className={`stat-badge ${kind} ${wounded ? "wounded" : ""}`}
      aria-label={`${value} ${kind === "health" ? "points de vie" : "de puissance"}`}
      title={kind === "health" ? "Vie" : "Puissance"}
    >
      <Icon aria-hidden="true" />
      <strong>{value}</strong>
    </span>
  );
}
