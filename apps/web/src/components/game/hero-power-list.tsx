import { heroAbilities } from "@sylve/game";
import { AbilityIcon } from "./ability-icons";

export function HeroPowerList({
  level,
  uses = 0,
  turn = 1,
  inBattle = false,
}: {
  level: number;
  uses?: number;
  turn?: number;
  inBattle?: boolean;
}) {
  return (
    <ol className="hero-power-list" aria-label="Capacités du héros">
      {heroAbilities(level, uses, turn).map((ability, index) => (
        <li key={ability.id} data-locked={ability.state === "level"}>
          <AbilityIcon
            kind={
              index === 1
                ? "reinforcement"
                : index === 2
                  ? "temporary"
                  : "power"
            }
          />
          <div>
            <strong>
              {index + 1}. {ability.name}
            </strong>
            <span>
              {inBattle && ability.state === "used"
                ? "Utilisé"
                : ability.state === "level"
                  ? `Niveau ${ability.unlockLevel}`
                  : inBattle && ability.state === "previous"
                    ? "Pouvoir précédent requis"
                    : inBattle && ability.state === "ready"
                      ? "Prêt"
                      : `À partir de ton tour ${ability.readyTurn}`}
            </span>
            <p>{ability.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
