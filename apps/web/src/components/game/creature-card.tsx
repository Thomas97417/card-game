import type { PointerEventHandler } from "react";
import {
  combatTypeLabel,
  getCombatType,
  RARITY_LABELS,
  FACTION_LABELS,
  type CardDefinition,
} from "@sylve/game";
import { Check } from "lucide-react";
import { CreaturePortrait } from "./creature-portrait";
import { StatBadge } from "./stat-badge";
import { CardAbilityIcons } from "./ability-icons";
import { FactionBackdrop } from "./faction-artwork";

export function CreatureCard({
  card,
  selected = false,
  compact = false,
  disabled = false,
  inspectable = false,
  onClick,
  onPointerDown,
}: {
  card: CardDefinition;
  selected?: boolean;
  compact?: boolean;
  disabled?: boolean;
  inspectable?: boolean;
  onClick?: () => void;
  onPointerDown?: PointerEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      className={`creature-card ${compact ? "compact" : ""} ${selected ? "selected" : ""}`}
      data-rarity={card.rarity ?? "common"}
      data-faction={card.faction}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={onPointerDown}
      aria-pressed={inspectable ? undefined : selected}
      aria-haspopup={inspectable ? "dialog" : undefined}
      aria-label={`${card.name}, ${combatTypeLabel(card)}, ${card.attack} attaque, ${card.health} points de vie, ${RARITY_LABELS[card.rarity ?? "common"]}, niveau ${card.level ?? 1}${selected ? ", sélectionnée" : ""}${inspectable ? ", voir les informations" : ""}`}
      title={`${card.name} · ${combatTypeLabel(card)}${card.faction ? ` · ${FACTION_LABELS[card.faction]}` : ""}`}
    >
      <div
        className="card-portrait"
        style={{ backgroundColor: `${card.color}55` }}
      >
        <FactionBackdrop card={card} />
        <CreaturePortrait card={card} />
      </div>
      <div className="card-stats">
        <StatBadge
          kind="attack"
          value={card.attack}
          combatType={getCombatType(card)}
        />
        <StatBadge kind="health" value={card.health} />
      </div>
      <span className="card-level">Niv. {card.level ?? 1}</span>
      <CardAbilityIcons card={card} />
      {selected && (
        <span className="card-check">
          <Check size={13} />
        </span>
      )}
    </button>
  );
}
