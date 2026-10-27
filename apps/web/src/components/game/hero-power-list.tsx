import { heroAbilities, type HeroId } from "@sylve/game";
import { Check, Clock3, LockKeyhole } from "lucide-react";
import { AbilityIcon } from "./ability-icons";

export function HeroPowerList({
  level,
  heroId,
  uses = 0,
  turn = 1,
  inBattle = false,
}: {
  level: number;
  heroId?: HeroId;
  uses?: number;
  turn?: number;
  inBattle?: boolean;
}) {
  const abilities = heroAbilities(level, uses, turn, heroId).filter(
    (ability) => !inBattle || ability.unlockLevel <= level,
  );
  return (
    <ol
      className="hero-power-list"
      aria-label="Capacités du héros"
      data-battle={inBattle}
    >
      {abilities.map((ability, index) => (
        <li
          key={ability.id}
          data-locked={ability.state === "level"}
          data-state={ability.state}
        >
          <AbilityIcon kind={ability.icon} />
          <div className="hero-power-copy">
            <div className="hero-power-title">
              <strong>
                {!inBattle && `${index + 1}. `}
                {ability.name}
              </strong>
              <span className="hero-power-badge">
                {inBattle && ability.state === "used" ? (
                  <Check size={12} />
                ) : ability.state === "level" ? (
                  <LockKeyhole size={11} />
                ) : ability.state === "turn" ? (
                  <Clock3 size={12} />
                ) : null}
                {inBattle && ability.state === "used"
                  ? "Utilisé"
                  : ability.state === "level"
                    ? `Niveau ${ability.unlockLevel}`
                    : inBattle && ability.state === "previous"
                      ? "En attente"
                      : inBattle && ability.state === "ready"
                        ? "Prêt"
                        : inBattle
                          ? `Tour ${ability.readyTurn}`
                          : `À partir de ton tour ${ability.readyTurn}`}
              </span>
            </div>
            <p>{ability.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
