import type { CSSProperties } from "react";
import type { CardRarity } from "@sylve/game";

export type CardRevealEffect = "discovery" | "legendary";

export const CARD_REVEAL_DURATION: Record<CardRevealEffect, number> = {
  discovery: 1_600,
  legendary: 2_400,
};

export function cardRevealEffect(
  rarity: CardRarity | undefined,
  isNew: boolean,
): CardRevealEffect | null {
  if (rarity === "legendary") return "legendary";
  return isNew ? "discovery" : null;
}

export function CardRevealEffects({ kind }: { kind: CardRevealEffect }) {
  if (kind === "discovery")
    return (
      <div className="card-discovery-effects" aria-hidden="true">
        <span className="card-discovery-halo" />
        {Array.from({ length: 4 }, (_, index) => (
          <i className="card-discovery-mote" key={index} />
        ))}
      </div>
    );

  return (
    <div className="summon-legendary-effects" aria-hidden="true">
      <span className="summon-legendary-aura" />
      <span className="summon-legendary-rays" />
      <span className="summon-legendary-wave" />
      <span className="summon-legendary-wave is-delayed" />
      {Array.from({ length: 18 }, (_, index) => {
        const angle = (index / 18) * Math.PI * 2;
        const distance = 70 + (index % 3) * 20;
        return (
          <i
            className="summon-legendary-particle"
            key={index}
            style={
              {
                "--particle-x": `${Math.cos(angle) * distance}cqw`,
                "--particle-y": `${Math.sin(angle) * distance}cqw`,
                "--particle-delay": `${380 + (index % 4) * 55}ms`,
                "--particle-turn": `${index * 37}deg`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
