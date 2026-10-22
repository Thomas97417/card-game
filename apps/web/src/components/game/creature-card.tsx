import type { PointerEventHandler } from "react";
import type { CardDefinition } from "@sylve/game";
import { Check } from "lucide-react";
import { CreaturePortrait } from "./creature-portrait";
import { StatBadge } from "./stat-badge";

export function CreatureCard({
  card,
  selected = false,
  compact = false,
  disabled = false,
  onClick,
  onPointerDown,
}: {
  card: CardDefinition;
  selected?: boolean;
  compact?: boolean;
  disabled?: boolean;
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
      aria-pressed={selected}
      aria-label={`${card.name}, ${card.attack} attaque, ${card.health} points de vie${selected ? ", sélectionnée" : ""}`}
    >
      <div
        className="card-portrait"
        style={{ backgroundColor: `${card.color}55` }}
      >
        <CreaturePortrait card={card} />
        <div className="card-stats">
          <StatBadge kind="attack" value={card.attack} />
          <StatBadge kind="health" value={card.health} />
        </div>
        {selected && (
          <span className="card-check">
            <Check size={13} />
          </span>
        )}
      </div>
      <div className="card-copy">
        <span className="card-name">{card.name}</span>
        {!compact && <span className="card-flavor">{card.title}</span>}
      </div>
    </button>
  );
}
