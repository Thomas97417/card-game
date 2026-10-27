import {
  RARITY_LABELS,
  combatTypeLabel,
  getCombatType,
  FACTION_LABELS,
  GENDER_LABELS,
  type CardDefinition,
} from "@sylve/game";
import { cn } from "@/lib/utils";
import { CreaturePortrait } from "./creature-portrait";
import { FactionBackdrop, FactionIcon } from "./faction-artwork";
import { StatBadge } from "./stat-badge";
import { GameIcon } from "./game-icon";
import { CardAbilityIcons } from "./ability-icons";

export function CardPortrait({
  card,
  className,
}: {
  card: CardDefinition;
  className?: string;
}) {
  return (
    <div
      className={cn("upgrade-portrait", className)}
      data-faction={card.faction}
      data-rarity={card.rarity ?? "common"}
    >
      <FactionBackdrop card={card} />
      <div className="upgrade-portrait-stats">
        <StatBadge
          kind="attack"
          value={card.attack}
          combatType={getCombatType(card)}
        />
        <StatBadge kind="health" value={card.health} />
      </div>
      <span className="upgrade-card-level">Niv. {card.level ?? 1}</span>
      <CreaturePortrait card={card} />
      <CardAbilityIcons card={card} className="upgrade-portrait-abilities" />
      <div className="upgrade-portrait-caption">
        <span className="rarity-label" data-rarity={card.rarity ?? "common"}>
          {RARITY_LABELS[card.rarity ?? "common"]}
        </span>
        <span className="upgrade-portrait-name" aria-hidden="true">
          {card.name}
        </span>
        <div className="upgrade-card-type">
          <span className="upgrade-card-trait">
            <GameIcon kind={getCombatType(card)} size={16} />
            {combatTypeLabel(card)}
          </span>
          {card.faction && (
            <span className="upgrade-card-trait">
              <FactionIcon faction={card.faction} size={16} />
              {FACTION_LABELS[card.faction]}
            </span>
          )}
          {card.gender && (
            <span className="upgrade-card-trait">
              {GENDER_LABELS[card.gender]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
