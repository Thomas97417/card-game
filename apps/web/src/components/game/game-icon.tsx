/** Illustrated game symbols; the surrounding label supplies their meaning. */
export function GameIcon({
  kind,
  size = 20,
  className = "",
}: {
  kind: "health" | "melee" | "ranged";
  size?: number;
  className?: string;
}) {
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
