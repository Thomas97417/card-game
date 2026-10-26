const ICON_ARTWORK = {
  health: "health-heart",
  melee: "melee-sword",
  ranged: "ranged-bow",
  building: "building-tower",
  all: "all-cards",
  refuge: "refuge-map",
  sanctuary: "sanctuary-crystal",
  arena: "arena-swords",
  archives: "archives-book",
  guardian: "guardian-emblem",
  goldMine: "gold-mine",
  emeraldMine: "emerald-mine",
  settings: "settings-gear",
  logout: "logout-door",
  ranking: "ranking-trophy",
  friends: "friends-handshake",
  missions: "missions-scroll",
  chat: "world-chat-globe",
} as const;

export type GameIconKind = keyof typeof ICON_ARTWORK;

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
  kind: GameIconKind;
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
