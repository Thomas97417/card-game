import { baseCardId, type CardDefinition, type Faction } from "@sylve/game";

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
