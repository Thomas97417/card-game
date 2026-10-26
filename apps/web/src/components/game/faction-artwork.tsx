import {
  baseCardId,
  FACTION_LABELS,
  type CardDefinition,
  type Faction,
} from "@sylve/game";

export function FactionIcon({
  faction,
  size = 24,
}: {
  faction: Faction;
  size?: number;
}) {
  return (
    <img
      className="faction-icon"
      src={`/art/factions/${faction}-icon.webp`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
    />
  );
}

/** A quiet color field lets each character keep its own silhouette and palette. */
export function FactionBackdrop({ card }: { card: CardDefinition }) {
  if (!card.faction) return null;
  return (
    <span
      className="faction-backdrop"
      data-faction={card.faction}
      data-character={baseCardId(card)}
      aria-hidden="true"
    />
  );
}

export function CardFactionBadge({ card }: { card: CardDefinition }) {
  if (!card.faction) return null;
  const label = FACTION_LABELS[card.faction];
  return (
    <span
      className="card-faction-badge"
      data-faction={card.faction}
      role="img"
      aria-label={`Famille ${label}`}
      title={label}
    >
      <FactionIcon faction={card.faction} />
    </span>
  );
}
