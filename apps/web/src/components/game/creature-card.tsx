import type { PointerEventHandler } from "react";
import { combatTypeLabel, getCombatType, type CardDefinition } from "@sylve/game";
import { Check } from "lucide-react";
import { CreaturePortrait } from "./creature-portrait";
import { StatBadge } from "./stat-badge";

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
      disabled={disabled}
      onClick={onClick}
      onPointerDown={onPointerDown}
      aria-pressed={inspectable ? undefined : selected}
      aria-haspopup={inspectable ? "dialog" : undefined}
      aria-label={`${card.name}, ${combatTypeLabel(card)}, ${card.attack} attaque, ${card.health} points de vie${selected ? ", sélectionnée" : ""}${inspectable ? ", voir les informations" : ""}`}
      title={`${card.name} · ${combatTypeLabel(card)}`}
    >
      <div
        className="card-portrait"
        style={{ backgroundColor: `${card.color}55` }}
      >
        <CreaturePortrait card={card} />
      </div>
      <div className="card-stats">
        <StatBadge kind="attack" value={card.attack} combatType={getCombatType(card)} />
        <StatBadge kind="health" value={card.health} />
      </div>
      {selected && (
        <span className="card-check">
          <Check size={13} />
        </span>
      )}
    </button>
  );
}
