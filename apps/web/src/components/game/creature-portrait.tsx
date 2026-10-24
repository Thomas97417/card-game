import { baseCardId, type CardDefinition } from "@sylve/game";

/** Original generated full-body art, shared by the cards and battlefield. */
export function CreaturePortrait({
  card,
  className = "",
}: {
  card: CardDefinition;
  className?: string;
}) {
  return (
    <img
      className={`creature-portrait ${className}`}
      src={
        card.kind === "field-building"
          ? `/art/field/${card.id.replace(/^field-/, "")}.webp`
          : `/art/characters/${baseCardId(card)}.webp`
      }
      alt={card.name}
      width={256}
      height={256}
      draggable={false}
    />
  );
}
