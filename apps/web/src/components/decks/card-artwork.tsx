import {
  combatTypeLabel,
  getCombatType,
  maxCardLevel,
  upgradeCost,
  type CardDefinition,
} from "@sylve/game";
import { CreaturePortrait } from "@/components/game/creature-portrait";
import { CardAbilityIcons } from "@/components/game/ability-icons";
import { StatBadge } from "@/components/game/stat-badge";
import { GameIcon } from "@/components/game/game-icon";

export function CardArtwork({
  card,
  copies = 0,
}: {
  card: CardDefinition;
  copies?: number;
}) {
  const type = getCombatType(card);
  return (
    <>
      <span className="workshop-card-art">
        <span className="workshop-card-halo" />
        <CreaturePortrait card={card} />
      </span>
      <span className="card-level">Niv. {card.level ?? 1}</span>
      <CardAbilityIcons card={card} className="workshop-card-abilities" />
      <span className="card-stats">
        <StatBadge kind="attack" value={card.attack} combatType={type} />
        <StatBadge kind="health" value={card.health} />
      </span>
      <span className="workshop-card-caption">
        <span className="workshop-card-name">{card.name}</span>
        <span className="workshop-card-type">
          <GameIcon kind={type} size={15} />
          {combatTypeLabel(card)}
        </span>
        <span className="workshop-copies">
          {(card.level ?? 1) >= maxCardLevel(card.rarity, card.baseId)
            ? `${copies} · MAX`
            : `${copies} / ${upgradeCost(card.level ?? 1, card.rarity)}`}
        </span>
      </span>
    </>
  );
}
