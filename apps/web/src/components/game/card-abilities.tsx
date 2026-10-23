import { LockKeyhole, Sparkles } from "lucide-react";
import type { CardDefinition } from "@sylve/game";

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
      <h3>
        <Sparkles size={15} aria-hidden="true" /> Capacités
      </h3>
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
                  {ability.active ? (
                    <Sparkles size={13} />
                  ) : (
                    <LockKeyhole size={13} />
                  )}
                  {ability.name}
                </strong>
                <span>
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
