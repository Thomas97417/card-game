import { Landmark } from "lucide-react";

/** Illustrated game symbols; the surrounding label supplies their meaning. */
export function GameIcon({
  kind,
  size = 20,
  className = "",
}: {
  kind: "health" | "melee" | "ranged" | "building";
  size?: number;
  className?: string;
}) {
  if (kind === "building")
    return (
      <Landmark
        className={`game-icon ${className}`}
        size={size}
        aria-hidden="true"
      />
    );
  return (
    <img
      className={`game-icon ${className}`}
      src={`/art/ui/${kind === "health" ? "health-heart" : kind === "melee" ? "melee-sword" : "ranged-bow"}.webp`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      draggable={false}
      decoding="async"
    />
  );
}
