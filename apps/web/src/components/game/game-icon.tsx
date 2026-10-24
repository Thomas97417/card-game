const ICON_ARTWORK = {
  health: "health-heart",
  melee: "melee-sword",
  ranged: "ranged-bow",
  building: "building-tower",
  all: "all-cards",
} as const;

interface IconProps {
  size?: number;
  className?: string;
}

/** Illustrated game symbols; the surrounding label supplies their meaning. */
export function GameIcon({
  kind,
  size = 20,
  className = "",
}: IconProps & {
  kind: keyof typeof ICON_ARTWORK;
}) {
  return (
    <img
      className={`game-icon ${className}`}
      src={`/art/ui/${ICON_ARTWORK[kind]}.webp`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      draggable={false}
      decoding="async"
    />
  );
}

export function CollectionIcon(props: IconProps) {
  return <GameIcon kind="all" {...props} />;
}
