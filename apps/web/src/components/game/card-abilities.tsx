import { LockKeyhole } from "lucide-react";
import type { CardDefinition } from "@sylve/game";
import { AbilityIcon, abilityIconKind } from "./ability-icons";

export function CardAbilities({
  card,
  next,
}: {
  card: CardDefinition;
  next?: CardDefinition | null;
}) {
  if (!card.abilities?.length) return null;
  return (
    <section className="card-abilities" aria-label="Capacités de la carte">
      <h3>Capacités</h3>
      <ul>
        {card.abilities.map((ability) => {
          const upgraded = next?.abilities?.find((a) => a.id === ability.id);
          const changes =
            upgraded &&
            (upgraded.active !== ability.active ||
              upgraded.description !== ability.description);
          return (
            <li key={ability.id} data-locked={!ability.active}>
              <div className="ability-title">
                <strong>
                  <AbilityIcon kind={abilityIconKind(ability)} size={32} />
                  {ability.name}
                </strong>
                <span>
                  {!ability.active && (
                    <LockKeyhole size={11} aria-hidden="true" />
                  )}
                  {ability.active
                    ? `Active · niv. ${ability.unlockLevel}`
                    : `Niv. ${ability.unlockLevel}`}
                </span>
              </div>
              <p>{ability.description}</p>
              {changes && (
                <p className="ability-next">
                  Niv. {next!.level} :{" "}
                  {upgraded.active && !ability.active ? "Débloquée · " : ""}
                  {upgraded.description}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
