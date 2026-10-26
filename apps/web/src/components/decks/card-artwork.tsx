import {
  combatTypeLabel,
  getCombatType,
  maxCardLevel,
  upgradeCost,
  type CardDefinition,
} from "@sylve/game";
import { ArrowUp } from "lucide-react";
import { CreaturePortrait } from "@/components/game/creature-portrait";
import { CardAbilityIcons } from "@/components/game/ability-icons";
import { StatBadge } from "@/components/game/stat-badge";
import { GameIcon } from "@/components/game/game-icon";
import {
  CardFactionBadge,
  FactionBackdrop,
} from "@/components/game/faction-artwork";

export function CardArtwork({
  card,
  copies = 0,
  showCopies = true,
  appearance = "default",
}: {
  card: CardDefinition;
  copies?: number;
  showCopies?: boolean;
  appearance?: "default" | "deck";
}) {
  const type = getCombatType(card);
  const level = card.level ?? 1;
  const canUpgrade =
    appearance === "deck" &&
    level < maxCardLevel(card.rarity, card.baseId) &&
    copies >= upgradeCost(level, card.rarity);
  return (
    <>
      <span className="workshop-card-art">
        <FactionBackdrop card={card} />
        <span className="workshop-card-halo" />
        <CreaturePortrait card={card} />
      </span>
      <span className="card-level">
        Niv. {level}
        {canUpgrade && (
          <span
            className="card-upgrade-indicator"
            role="img"
            aria-label="Assez de cartes pour améliorer"
            title="Assez de cartes pour améliorer"
          >
            <ArrowUp size={11} strokeWidth={3} aria-hidden="true" />
          </span>
        )}
      </span>
      <CardFactionBadge card={card} />
      <CardAbilityIcons card={card} className="workshop-card-abilities" />
      <span className="card-stats">
        <StatBadge kind="attack" value={card.attack} combatType={type} />
        <StatBadge kind="health" value={card.health} />
      </span>
      <span className="workshop-card-caption">
        <span className="workshop-card-name">{card.name}</span>
        {appearance !== "deck" && (
          <span className="workshop-card-type">
            <GameIcon kind={type} size={15} />
            {combatTypeLabel(card)}
          </span>
        )}
        {appearance !== "deck" && showCopies && (
          <span className="workshop-copies">
            {level >= maxCardLevel(card.rarity, card.baseId)
              ? `${copies} · MAX`
              : `${copies} / ${upgradeCost(level, card.rarity)}`}
          </span>
        )}
      </span>
    </>
  );
}
