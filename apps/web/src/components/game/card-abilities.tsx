import { Popover } from "@base-ui/react/popover";
import { ArrowUpRight, LockKeyhole, X } from "lucide-react";
import type { CardAbility, CardDefinition } from "@sylve/game";
import { AbilityIcon, abilityIconKind } from "./ability-icons";

export function CardAbilities({
  card,
  next,
  compactNext = false,
}: {
  card: CardDefinition;
  next?: CardDefinition | null;
  compactNext?: boolean;
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
                {compactNext && changes ? (
                  <AbilityLevelPreview
                    key={`${ability.id}-${next!.level}`}
                    ability={ability}
                    upgraded={upgraded}
                    level={next!.level!}
                  />
                ) : (
                  <span>
                    {!ability.active && (
                      <LockKeyhole size={11} aria-hidden="true" />
                    )}
                    {ability.active
                      ? `Active · niv. ${ability.unlockLevel}`
                      : `Niv. ${ability.unlockLevel}`}
                  </span>
                )}
              </div>
              <p>{ability.description}</p>
              {changes && !compactNext && (
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

function AbilityLevelPreview({
  ability,
  upgraded,
  level,
}: {
  ability: CardAbility;
  upgraded: CardAbility;
  level: number;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        className="ability-next-trigger"
        aria-label={`Voir ${ability.name} au niveau ${level}`}
        openOnHover
      >
        Niv. {level} <ArrowUpRight size={12} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="top"
          align="end"
          sideOffset={8}
          className="z-[60] outline-none"
        >
          <Popover.Popup
            initialFocus={false}
            className="relative w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-[#c5b38366] bg-[#18372b] p-4 text-[#f4ecd6] shadow-xl outline-none [font-family:'Avenir_Next',Avenir,'Segoe_UI',sans-serif]"
          >
            <Popover.Title className="pr-7 text-xs font-semibold text-[#e6cc8e]">
              {ability.name} · niveau {level}
            </Popover.Title>
            <Popover.Description className="mt-2 text-xs leading-5">
              {upgraded.active && !ability.active && "Débloquée · "}
              {upgraded.description}
            </Popover.Description>
            <p className="mt-3 text-[10px] text-[#becbb8]">
              {ability.active
                ? `Active depuis le niveau ${ability.unlockLevel}`
                : `Disponible au niveau ${ability.unlockLevel}`}
            </p>
            <Popover.Close
              aria-label="Fermer l’aperçu du niveau"
              className="absolute top-2 right-2 grid size-7 place-items-center rounded-md text-[#c6bd9e] hover:bg-[#d4be881a] focus-visible:outline-2 focus-visible:outline-[#d4be88]"
            >
              <X size={14} aria-hidden="true" />
            </Popover.Close>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
