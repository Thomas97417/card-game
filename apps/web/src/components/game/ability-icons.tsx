import type { CSSProperties } from "react";
import { LockKeyhole } from "lucide-react";
import {
  unitCard,
  type AbilityEffect,
  type CardAbility,
  type CardDefinition,
  type GameEvent,
  type GameView,
} from "@sylve/game";

export type AbilityIconKind =
  | "power"
  | "vitality"
  | "heal"
  | "block"
  | "spikes"
  | "vampirism"
  | "regeneration"
  | "mental-shield"
  | "double-strike"
  | "piercing"
  | "life-rune"
  | "reinforcement"
  | "order-alliance"
  | "weaken"
  | "blocked"
  | "temporary";

const effectIcons: Record<AbilityEffect, AbilityIconKind> = {
  attack: "power",
  health: "vitality",
  heal: "heal",
  block: "block",
  spikes: "spikes",
  vampirism: "vampirism",
  regeneration: "regeneration",
  shield: "mental-shield",
  extra_attack: "double-strike",
  pierce: "piercing",
  rune: "life-rune",
  summon: "reinforcement",
  attack_per_ally: "order-alliance",
};

export function abilityIconKind(
  ability: Pick<CardAbility, "effect" | "value">,
): AbilityIconKind {
  return ability.effect === "attack" && ability.value < 0
    ? "weaken"
    : effectIcons[ability.effect];
}

/** The label belongs to the enclosing badge or text, so the bitmap stays decorative. */
export function AbilityIcon({
  kind,
  size,
  className = "",
}: {
  kind: AbilityIconKind;
  size?: number;
  className?: string;
}) {
  return (
    <img
      className={`ability-icon ${className}`}
      src={`/art/abilities/${kind}.webp`}
      width={size ?? 24}
      height={size ?? 24}
      style={
        size ? ({ "--ability-size": `${size}px` } as CSSProperties) : undefined
      }
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
    />
  );
}

export function EffectBadge({
  kind,
  label,
  value,
  locked = false,
}: {
  kind: AbilityIconKind;
  label: string;
  value?: string | number;
  locked?: boolean;
}) {
  return (
    <span
      className={`effect-badge ${locked ? "is-locked" : ""}`}
      data-effect={kind}
      role="img"
      aria-label={label}
      title={label}
    >
      <AbilityIcon kind={kind} />
      {value !== undefined && (
        <span className="effect-badge-value" aria-hidden="true">
          {value}
        </span>
      )}
      {locked && (
        <LockKeyhole
          className="effect-badge-lock"
          size={10}
          aria-hidden="true"
        />
      )}
    </span>
  );
}

const storedPassives = new Set<AbilityEffect>([
  "shield",
  "block",
  "spikes",
  "vampirism",
  "regeneration",
]);

export function CardAbilityIcons({
  card,
  className = "",
  showLocked = true,
  onBoard = false,
}: {
  card: CardDefinition;
  className?: string;
  showLocked?: boolean;
  onBoard?: boolean;
}) {
  const abilities = card.abilities?.filter(
    (ability) =>
      (ability.active || showLocked) &&
      !(
        onBoard &&
        ability.trigger === "passive" &&
        storedPassives.has(ability.effect)
      ),
  );
  if (!abilities?.length) return null;
  return (
    <span
      className={`card-ability-icons ${className}`}
      role="group"
      aria-label={`Capacités de ${card.name}`}
    >
      {abilities.map((ability) => (
        <EffectBadge
          key={ability.id}
          kind={abilityIconKind(ability)}
          locked={!ability.active}
          label={`${ability.name} · ${ability.active ? "Active" : "Verrouillée"} · niveau ${ability.unlockLevel}. ${ability.description}`}
        />
      ))}
    </span>
  );
}

type BoardUnit = GameView["players"][number]["board"][number];
interface UnitEffect {
  kind: AbilityIconKind;
  label: string;
  description: string;
  value?: string | number;
}

/** Read the live instance, rather than assuming its original passives still exist. */
export function unitEffects(
  unit: BoardUnit,
  cards: readonly CardDefinition[],
  blocked = false,
): UnitEffect[] {
  if (unit.hp <= 0) return [];
  const base = unitCard(unit, cards);
  const effects: UnitEffect[] = [];
  if (unit.shield)
    effects.push({
      kind: "mental-shield",
      label: "Bouclier mental",
      description: "Annule les prochains dégâts, puis disparaît.",
    });
  if (unit.block)
    effects.push({
      kind: "block",
      label: `Blocage ${unit.block}`,
      value: unit.block,
      description: `Réduit chaque attaque physique de ${unit.block} dégâts.`,
    });
  if (unit.spikes)
    effects.push({
      kind: "spikes",
      label: `Épines ${unit.spikes}`,
      value: unit.spikes,
      description: `Renvoie ${unit.spikes} dégâts à l’attaquant.`,
    });
  if (unit.regeneration)
    effects.push({
      kind: "regeneration",
      label: `Régénération ${unit.regeneration}`,
      value: unit.regeneration,
      description: `Rend jusqu’à ${unit.regeneration} PV au début de ton tour.`,
    });
  if (unit.vampirism)
    effects.push({
      kind: "vampirism",
      label: `Vampirisme ${unit.vampirism}`,
      value: unit.vampirism,
      description: `Draine jusqu’à ${unit.vampirism} PV après l’attaque et soigne son porteur.`,
    });
  const attack = unit.card.attack - base.attack;
  if (attack > 0)
    effects.push({
      kind: "power",
      label: `Puissance +${attack}`,
      value: `+${attack}`,
      description: `Attaque de base : ${base.attack}. Attaque actuelle : ${unit.card.attack}.`,
    });
  if (attack < 0)
    effects.push({
      kind: "weaken",
      label: `Affaiblissement ${attack}`,
      value: attack,
      description: `Attaque de base : ${base.attack}. Attaque actuelle : ${unit.card.attack}.`,
    });
  const health = unit.card.health - base.health;
  if (health > 0)
    effects.push({
      kind: "vitality",
      label: `Vitalité +${health}`,
      value: `+${health}`,
      description: `Vie maximale augmentée de ${base.health} à ${unit.card.health} PV.`,
    });
  if (unit.temporaryAttack)
    effects.push({
      kind: "temporary",
      label: `Bonus temporaire +${unit.temporaryAttack}`,
      value: `+${unit.temporaryAttack}`,
      description:
        "Ce bonus d’attaque expire après l’assaut de son propriétaire.",
    });
  if (blocked)
    effects.unshift({
      kind: "blocked",
      label: "Attaque bloquée",
      description: "Un allié devant cette unité l’empêche d’attaquer.",
    });
  return effects;
}

export function UnitEffectIcons({
  unit,
  cards,
  blocked = false,
  detailed = false,
}: {
  unit: BoardUnit;
  cards: readonly CardDefinition[];
  blocked?: boolean;
  detailed?: boolean;
}) {
  const effects = unitEffects(unit, cards, blocked);
  if (!effects.length) return null;
  if (detailed)
    return (
      <section className="unit-effects-details" aria-label="États actuels">
        <h3>États actuels</h3>
        <ul>
          {effects.map((effect) => (
            <li key={effect.kind}>
              <AbilityIcon kind={effect.kind} size={32} />
              <span>
                <strong>{effect.label}</strong>
                <span>{effect.description}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    );
  return (
    <span
      className="unit-statuses"
      role="group"
      aria-label={`États de ${unit.card.name}`}
    >
      {effects.slice(0, 4).map((effect) => (
        <EffectBadge
          key={effect.kind}
          kind={effect.kind}
          value={effect.value}
          label={`${effect.label}. ${effect.description}`}
        />
      ))}
      {effects.length > 4 && (
        <span
          className="effect-overflow"
          role="img"
          aria-label={`${effects.length - 4} autres états : ${effects
            .slice(4)
            .map((e) => e.label)
            .join(", ")}. Ouvre la fiche pour les consulter.`}
          title={effects
            .slice(4)
            .map((e) => `${e.label}. ${e.description}`)
            .join("\n")}
        >
          +{effects.length - 4}
        </span>
      )}
    </span>
  );
}

const eventIcons: Record<string, AbilityIconKind> = {
  Puissance: "power",
  Vitalité: "vitality",
  Soin: "heal",
  Blocage: "block",
  Épines: "spikes",
  Vampirisme: "vampirism",
  Régénération: "regeneration",
  "Bouclier mental": "mental-shield",
  "Double attaque": "double-strike",
  Perforation: "piercing",
  "Rune de vie": "life-rune",
  "Rune de puissance": "power",
  "Pentagramme de vie": "vitality",
  "Pentagramme de puissance": "power",
  Renfort: "reinforcement",
  "Alliance de l’Ordre": "order-alliance",
  Affaiblissement: "weaken",
  "Fin du bonus temporaire": "temporary",
};
export function eventIconKind(
  event: Pick<GameEvent, "ability" | "amount">,
): AbilityIconKind | undefined {
  if (event.ability === "Puissance" && (event.amount ?? 0) < 0) return "weaken";
  return event.ability ? eventIcons[event.ability] : undefined;
}
