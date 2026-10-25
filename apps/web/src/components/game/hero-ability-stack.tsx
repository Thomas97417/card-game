import { heroAbilities, type GameView, type HeroAbilityId } from "@sylve/game";
import { Info, LockKeyhole } from "lucide-react";
import { AbilityIcon } from "./ability-icons";

export function HeroAbilityStack({
  player,
  turn,
  canUse,
  onUse,
  onInspect,
}: {
  player: GameView["players"][number];
  turn: number;
  canUse: boolean;
  onUse: (id: HeroAbilityId, uses: number) => void;
  onInspect: () => void;
}) {
  if (player.heroLevel === undefined) return null;
  const uses = player.heroAbilityUses ?? 0;
  const abilities = heroAbilities(player.heroLevel, uses, turn);
  const ability = abilities[Math.min(3, uses)]!;
  const deathCards = Math.max(
    0,
    Math.ceil(turn / 2) - 10 - Math.max(0, uses - 3),
  );
  const ready = ability.state === "ready";
  const label =
    ability.state === "level"
      ? `Niveau ${ability.unlockLevel}`
      : ability.state === "turn"
        ? `Ton tour ${ability.readyTurn}`
        : "Prêt";
  const icon =
    ability.id === "call_to_arms"
      ? "reinforcement"
      : ability.id === "heavenly_power"
        ? "temporary"
        : "power";
  return (
    <aside className="hero-power-pile" aria-label="Pouvoirs du héros">
      <div className="hero-power-heading">
        <span>POUVOIRS</span>
        <button
          type="button"
          onClick={onInspect}
          aria-label="Voir les pouvoirs du héros"
          title="Voir les pouvoirs du héros"
        >
          <Info size={14} />
        </button>
      </div>
      <div
        className="hero-power-cards"
        data-remaining={uses < 3 ? 3 - uses : Math.max(1, deathCards)}
      >
        <button
          type="button"
          className="hero-power-card"
          data-ready={ready && canUse}
          disabled={!canUse || !ready}
          title={`${ability.name}. ${ability.description} ${label}.`}
          aria-label={`Utiliser ${ability.name}. ${ability.description} ${label}.`}
          onClick={() => onUse(ability.id, uses)}
        >
          <span className="hero-power-number">
            {uses < 3
              ? `${uses + 1} / 3`
              : deathCards
                ? `${deathCards} en pile`
                : "∞"}
          </span>
          <AbilityIcon kind={icon} />
          <strong>{ability.name}</strong>
          <span className="hero-power-value">
            {ability.id === "call_to_arms"
              ? "2 renforts"
              : ability.id === "heavenly_power"
                ? `+${ability.value} ATQ`
                : `${ability.value} dégâts`}
          </span>
          <span className="hero-power-status">
            {!ready && <LockKeyhole size={10} />}
            {label}
          </span>
        </button>
      </div>
      <span className="hero-power-hint">Avant ta créature</span>
    </aside>
  );
}
