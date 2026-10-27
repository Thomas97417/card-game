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
  | "freeze"
  | "execution"
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
  | "temporary"
  | "poison"
  | "silence"
  | "immunity"
  | "evasion"
  | "counter-attack";

const effectIcons: Record<AbilityEffect, AbilityIconKind> = {
  freeze: "freeze",
  execute: "execution",
  sacrifice: "temporary",
  set_health: "vitality",
  block_rune: "block",
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
  health_per_ally: "vitality",
  heal_full: "heal",
  damage: "power",
  poison: "poison",
  steal_attack: "weaken",
  attack_rune: "power",
  cleanse: "heal",
  silence: "silence",
  drain: "vampirism",
  counter_attack: "counter-attack",
  immunity: "immunity",
  evasion: "evasion",
  set_attack: "weaken",
  attack_curse: "weaken",
  hero_damage_from_health: "power",
  poison_enemy: "poison",
  splash: "power",
  reflect_damage: "spikes",
  attack_pentagram: "power",
  health_pentagram: "vitality",
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
  "poison",
  "immunity",
  "evasion",
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
  if (unit.frozen)
    effects.push({
      kind: "freeze",
      label: "Gel",
      description: "Ne peut pas attaquer pendant son prochain tour.",
    });
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
  if (unit.poison)
    effects.push({
      kind: "poison",
      label: `Poison ${unit.poison}`,
      value: unit.poison,
      description: `Les attaques empoisonnent leur cible pour ${unit.poison} dégâts récurrents.`,
    });
  if (unit.poisoned)
    effects.push({
      kind: "poison",
      label: `Empoisonné ${unit.poisoned}`,
      value: unit.poisoned,
      description: `Subit ${unit.poisoned} dégâts au début de son tour, avant la régénération.`,
    });
  if (unit.extraAttacks)
    effects.push({
      kind: "double-strike",
      label: `Attaques supplémentaires ${unit.extraAttacks}`,
      value: unit.extraAttacks,
      description: `Effectue ${unit.extraAttacks} attaque(s) supplémentaire(s) à chaque assaut.`,
    });
  if (unit.silenced)
    effects.push({
      kind: "silence",
      label: "Silence",
      description:
        "Compétences et bonus supprimés ; la purification ne retire pas ce silence.",
    });
  if (unit.immune)
    effects.push({
      kind: "immunity",
      label: "Immunité",
      description: "Ignore les compétences alliées et ennemies.",
    });
  if (unit.evasion)
    effects.push({
      kind: "evasion",
      label: "Esquive",
      description: "Évite les attaques physiques à distance.",
    });
  if (unit.counterAttack)
    effects.push({
      kind: "counter-attack",
      label: "Contre-attaque",
      description:
        "Riposte une fois à chaque attaque reçue ; une riposte ne provoque pas de nouvelle riposte.",
    });
  if (unit.attackLimit !== undefined)
    effects.push({
      kind: "weaken",
      label: `Entrave : ATQ ${unit.attackLimit}`,
      value: unit.attackLimit,
      description:
        "Attaque fixée jusqu’à la fin du prochain assaut de son propriétaire.",
    });
  if (unit.attackCurse)
    effects.push({
      kind: "weaken",
      label: `Malédiction ${unit.attackCurse}`,
      value: unit.attackCurse,
      description: `Subit ${unit.attackCurse} dégâts à chaque bonus d’attaque reçu.`,
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
  "Étreinte du Givre": "freeze",
  "Toucher de givre": "freeze",
  "Fin du gel": "freeze",
  "Sentence du Crépuscule": "execution",
  Éphémère: "temporary",
  "Venin du Crépuscule": "poison",
  "Armure de ronces": "spikes",
  "Souffle purificateur": "silence",
  "Fureur des Racines": "temporary",
  "Voile d’Impuissance": "weaken",
  "Accords protecteurs": "block",
  "Rune de blocage": "block",
  "Note de Rupture": "vitality",
  "Second souffle": "vitality",
  "Soif ancienne": "vampirism",
  Reflet: "spikes",
  "Riposte des Braises": "power",
  "Puissance du Vide": "power",
  "Fureur des Braises": "power",
  Brasier: "power",
  "Présent explosif": "power",
  "Onde sonore": "power",
  "Tempête de feuilles": "power",
  "Appel des éclaireurs": "reinforcement",
  "Élan de la Sylve": "temporary",
  "Dernier souffle": "power",
  "Dégâts de zone": "power",
  "Reflet des dégâts": "spikes",
  Puissance: "power",
  Purification: "heal",
  Silence: "silence",
  "Drain de vie": "vampirism",
  "Contre-attaque": "counter-attack",
  Immunité: "immunity",
  Esquive: "evasion",
  Entrave: "weaken",
  Malédiction: "weaken",
  "Écho vital": "power",
  "Fin de l’entrave": "weaken",
  "Soin intégral": "heal",
  "Dégâts magiques": "power",
  Poison: "poison",
  Empoisonnement: "poison",
  "Vol d’attaque": "weaken",
  "Rune de puissance": "power",
  "Vitalité de formation": "vitality",
  "Puissance de formation": "order-alliance",
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
