import {
  combatTypeLabel,
  getCombatType,
  maxCardLevel,
  RARITY_LABELS,
  upgradeCost,
  type CardDefinition,
  type CardRarity,
} from "@sylve/game";
import { ArrowUp } from "lucide-react";
import { CreaturePortrait } from "@/components/game/creature-portrait";
import { CardAbilityIcons } from "@/components/game/ability-icons";
import { StatBadge } from "@/components/game/stat-badge";
import { GameIcon } from "@/components/game/game-icon";
import { FactionBackdrop } from "@/components/game/faction-artwork";

export function CardArtwork({
  card,
  copies = 0,
  showCopies = true,
  showCombatType = true,
  appearance = "default",
  showUpgradeIndicator = appearance === "deck",
}: {
  card: CardDefinition;
  copies?: number;
  showCopies?: boolean;
  showCombatType?: boolean;
  appearance?: "default" | "deck";
  showUpgradeIndicator?: boolean;
}) {
  const type = getCombatType(card);
  const level = card.level ?? 1;
  const canUpgrade =
    showUpgradeIndicator &&
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
      <CardAbilityIcons card={card} className="workshop-card-abilities" />
      <span className="card-stats">
        <StatBadge kind="attack" value={card.attack} combatType={type} />
        <StatBadge kind="health" value={card.health} />
      </span>
      <span className="workshop-card-caption">
        <span className="workshop-card-name">{card.name}</span>
        {appearance !== "deck" && showCombatType && (
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

export function CardRewardFooter({
  rarity,
  count,
}: {
  rarity: CardRarity;
  count: number;
}) {
  return (
    <span className="reward-card-footer" aria-hidden="true">
      <span className="reward-card-rarity" data-rarity={rarity}>
        {RARITY_LABELS[rarity]}
      </span>
      <span className="reward-card-quantity">
        <span>×</span>
        <strong>{count.toLocaleString("fr-FR")}</strong>
      </span>
    </span>
  );
}
