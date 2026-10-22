import type { PointerEventHandler } from "react";
import type { CardDefinition } from "@sylve/game";
import { Check, Heart, Swords } from "lucide-react";
import { CreaturePortrait } from "./creature-portrait";

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
      <div className="card-portrait">
        <CreaturePortrait card={card} />
        {selected && (
          <span className="card-check">
            <Check size={13} />
          </span>
        )}
      </div>
      <div className="card-copy">
        <span className="card-name">{card.name}</span>
        {!compact && <span className="card-flavor">{card.title}</span>}
        <div className="card-stats">
          <span>
            <Swords size={14} />
            {card.attack}
          </span>
          <span>
            <Heart size={14} />
            {card.health}
          </span>
        </div>
      </div>
    </button>
  );
}
