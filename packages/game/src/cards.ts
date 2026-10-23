import reference from "./data/mighty-party.json";

export const MAX_CARD_LEVEL = 26;
export type CombatType = "melee" | "ranged" | "building";
export type Faction = "order" | "nature" | "chaos";
export type CardRarity = "common" | "rare" | "epic" | "legendary";
export const RARITIES: readonly CardRarity[] = [
  "common",
  "rare",
  "epic",
  "legendary",
];
export const RARITY_LABELS: Record<CardRarity, string> = {
  common: "Commune",
  rare: "Rare",
  epic: "Épique",
  legendary: "Légendaire",
};
export const FACTION_LABELS: Record<Faction, string> = {
  order: "Ordre",
  nature: "Nature",
  chaos: "Chaos",
};
export type AbilityEffect =
  | "attack"
  | "health"
  | "heal"
  | "block"
  | "spikes"
  | "vampirism"
  | "regeneration"
  | "shield"
  | "extra_attack"
  | "pierce"
  | "rune"
  | "summon"
  | "attack_per_ally";
export type AbilityTrigger =
  | "deploy"
  | "turn_start"
  | "nature_ally_appears"
  | "death"
  | "enemy_hero_attacked"
  | "passive";
export type AbilityTarget =
  | "self"
  | "random_ally"
  | "column_allies"
  | "row_allies"
  | "melee_allies"
  | "nature_allies"
  | "order_allies"
  | "all_allies"
  | "all_enemies"
  | "ally_hero"
  | "ally_buildings"
  | "random_zombie";
export interface CardAbility {
  id: string;
  name: string;
  description: string;
  unlockLevel: number;
  active: boolean;
  effect: AbilityEffect;
  trigger: AbilityTrigger;
  target: AbilityTarget;
  value: number;
  temporary?: boolean;
  summon?: {
    kind: "archer" | "zombie";
    attack: number;
    health: number;
    level: number;
  };
}
export interface CardDefinition {
  id: string;
  name: string;
  title: string;
  attack: number;
  health: number;
  color: string;
  kind: string;
  combatType?: CombatType;
  faction?: Faction;
  sourceHero?: string;
  abilities?: CardAbility[];
  baseId?: string;
  rarity?: CardRarity;
  level?: number;
}
export interface OwnedCard {
  card: CardDefinition;
  copies: number;
}
export class GameError extends Error {}

// Each original identity is retained; the 22 common archetypes are mapped once.
const definitions = [
  {
    id: "guardian",
    name: "Gardien de pierre",
    title: "Le silence des anciens",
    color: "#78958a",
    kind: "golem",
    reference: "Warrior",
  },
  {
    id: "fox",
    name: "Renard des braises",
    title: "Une étincelle suffit",
    color: "#d6844d",
    kind: "fox",
    reference: "Archer",
  },
  {
    id: "owl",
    name: "Oracle des brumes",
    title: "Les yeux de la forêt",
    color: "#8e86ad",
    kind: "owl",
    reference: "Apprentice",
  },
  {
    id: "stag",
    name: "Cerf couronné",
    title: "Souverain des clairières",
    color: "#c1a267",
    kind: "stag",
    reference: "Pilgrim",
  },
  {
    id: "mushroom",
    name: "Sentinelle mousse",
    title: "Petit, mais tenace",
    color: "#b4706b",
    kind: "mushroom",
    reference: "Dryad",
  },
  {
    id: "dragon",
    name: "Dragon d’ambre",
    title: "Le souffle du soleil",
    color: "#dbab52",
    kind: "dragon",
    reference: "Shaman",
  },
  {
    id: "turtle",
    name: "Tortue millénaire",
    title: "La patience est une arme",
    color: "#83a575",
    kind: "turtle",
    reference: "Big Toad",
  },
  {
    id: "wisp",
    name: "Esprit des sources",
    title: "Un murmure dans l’eau",
    color: "#70b7b1",
    kind: "wisp",
    reference: "Raven",
  },
  {
    id: "wolf",
    name: "Loup de lune",
    title: "Quand la nuit s’éveille",
    color: "#9baec1",
    kind: "wolf",
    reference: "Red Orc",
  },
  {
    id: "knight",
    name: "Chevalier ronce",
    title: "Fidèle jusqu’au dernier jour",
    color: "#769a7c",
    kind: "knight",
    reference: "Servant",
  },
  {
    id: "serpent",
    name: "Vipère de jade",
    title: "L’éclair sous les feuilles",
    color: "#96af68",
    kind: "serpent",
    reference: "Blood Cult Adept",
  },
  {
    id: "bear",
    name: "Ours des cimes",
    title: "Le cœur de la montagne",
    color: "#b79780",
    kind: "bear",
    reference: "Lumberjack",
  },
  {
    id: "healer",
    name: "Féline des clairières",
    title: "Neuf vies à partager",
    color: "#c6a478",
    kind: "cat",
    reference: "Cat Lady",
  },
  {
    id: "gnome",
    name: "Artisan des racines",
    title: "Tout peut renaître",
    color: "#ac875a",
    kind: "gnome",
    reference: "Gnome",
  },
  {
    id: "idol",
    name: "Totem de l’aurore",
    title: "La lumière veille",
    color: "#b5a46d",
    kind: "totem",
    reference: "Idol",
  },
  {
    id: "enchantress",
    name: "Tisseuse de runes",
    title: "Les pierres se souviennent",
    color: "#c69c78",
    kind: "mage",
    reference: "Love Lady",
  },
  {
    id: "lynx",
    name: "Lynx du crépuscule",
    title: "Une ombre dans les feuilles",
    color: "#6a8e88",
    kind: "lynx",
    reference: "Shinobi",
  },
  {
    id: "bard",
    name: "Chanteur des feuillages",
    title: "L’écho de l’alliance",
    color: "#c3a762",
    kind: "bird",
    reference: "Singer",
  },
  {
    id: "tree",
    name: "Saule des murmures",
    title: "Les branches du doute",
    color: "#9b839e",
    kind: "tree",
    reference: "Tree",
  },
  {
    id: "vampire",
    name: "Chauve-souris pourpre",
    title: "Le baiser de la nuit",
    color: "#9d6986",
    kind: "bat",
    reference: "Vampire",
  },
  {
    id: "captain",
    name: "Capitaine des clairières",
    title: "Nul ne marche seul",
    color: "#8a9e73",
    kind: "captain",
    reference: "Warrioress",
  },
  {
    id: "witch",
    name: "Sorcière des spores",
    title: "Sous terre, une armée",
    color: "#9f79a4",
    kind: "witch",
    reference: "Witch",
  },
] as const;

type Mechanic = [AbilityEffect, AbilityTrigger, AbilityTarget, boolean?];
const mechanics: Record<string, Mechanic[]> = {
  Apprentice: [
    ["attack", "deploy", "random_ally"],
    ["health", "turn_start", "column_allies"],
  ],
  Archer: [
    ["pierce", "passive", "self"],
    ["attack", "turn_start", "self"],
  ],
  "Big Toad": [["spikes", "passive", "self"]],
  "Blood Cult Adept": [["vampirism", "deploy", "random_ally"]],
  "Cat Lady": [
    ["heal", "deploy", "ally_hero"],
    ["heal", "turn_start", "ally_hero"],
  ],
  Dryad: [
    ["health", "deploy", "melee_allies"],
    ["health", "deploy", "nature_allies"],
  ],
  Gnome: [
    ["heal", "enemy_hero_attacked", "ally_hero"],
    ["heal", "deploy", "ally_buildings"],
  ],
  Idol: [["attack", "turn_start", "random_ally"]],
  "Love Lady": [
    ["rune", "deploy", "self"],
    ["attack", "death", "all_allies"],
  ],
  Lumberjack: [["attack", "nature_ally_appears", "self"]],
  Pilgrim: [
    ["attack", "deploy", "order_allies", true],
    ["health", "deploy", "order_allies"],
  ],
  Raven: [["regeneration", "deploy", "random_ally"]],
  "Red Orc": [["extra_attack", "passive", "self"]],
  Servant: [
    ["block", "passive", "self"],
    ["block", "deploy", "row_allies"],
  ],
  Shaman: [["spikes", "deploy", "random_ally"]],
  Shinobi: [["shield", "passive", "self"]],
  Singer: [
    ["health", "deploy", "random_ally"],
    ["attack", "deploy", "order_allies"],
  ],
  Tree: [["attack", "deploy", "all_enemies"]],
  Vampire: [["vampirism", "passive", "self"]],
  Warrior: [
    ["block", "passive", "self"],
    ["attack_per_ally", "passive", "order_allies"],
  ],
  Warrioress: [
    ["summon", "deploy", "self"],
    ["heal", "turn_start", "column_allies"],
  ],
  Witch: [
    ["summon", "deploy", "self"],
    ["attack", "deploy", "random_zombie"],
  ],
};
const effectNames: Record<AbilityEffect, string> = {
  attack: "Puissance",
  health: "Vitalité",
  heal: "Soin",
  block: "Blocage",
  spikes: "Épines",
  vampirism: "Vampirisme",
  regeneration: "Régénération",
  shield: "Bouclier mental",
  extra_attack: "Double attaque",
  pierce: "Perforation",
  rune: "Rune de vie",
  summon: "Renfort",
  attack_per_ally: "Alliance de l’Ordre",
};
interface Progression {
  level: number;
  value?: number;
  attack?: number;
  health?: number;
  summonLevel?: number;
  summon?: string;
}
interface ReferenceCard {
  name: string;
  faction: string;
  combatType: string;
  stats: number[][];
  skills: {
    id: string;
    descriptionFr: string;
    unlockLevel: number;
    progression: Progression[];
  }[];
}
const data = reference as {
  cards: ReferenceCard[];
  costs: Record<CardRarity, number[][]>;
};

function build(
  base: (typeof definitions)[number],
  rarity: CardRarity,
  level: number,
): CardDefinition {
  const source = data.cards.find((c) => c.name === base.reference)!;
  const stats = source.stats[level - 1]!;
  // Higher-rarity Sylve variants keep their established bonuses; the sourced common
  // curves and skill milestones are shared. No invented levels 27–31 are extrapolated.
  const bonus = { common: 0, rare: 1, epic: 2, legendary: 4 }[rarity];
  const abilities = source.skills.map((skill, index): CardAbility => {
    const point =
      [...skill.progression].reverse().find((p) => p.level <= level) ??
      skill.progression[0]!;
    const [effect, trigger, target, temporary] =
      mechanics[base.reference]![index]!;
    let description = skill.descriptionFr.replace(
      /\{(\w+)\}/g,
      (_, key: string) => String(point[key as keyof Progression] ?? ""),
    );
    description = description
      .replace("Archer", "Éclaireur des braises")
      .replace("une Éclaireur", "un Éclaireur")
      .replace(/Zombie/g, "Rejeton des spores")
      .replace("chef de guerre", "héros")
      .replace("chef allié", "héros allié")
      .replace(" (« row » dans la source)", "");
    description = description
      .replace(/de sa ligne/g, "de sa colonne")
      .replace("de la ligne de la cible", "de la colonne de la cible");
    if (effect === "attack" && target === "all_enemies")
      description = `Réduit l’ATQ de tous les ennemis de ${Math.abs(point.value ?? 0)}.`;
    return {
      id: skill.id,
      name:
        effect === "attack" && (point.value ?? 0) < 0
          ? "Affaiblissement"
          : effectNames[effect],
      description,
      unlockLevel: skill.unlockLevel,
      active: level >= skill.unlockLevel,
      effect,
      trigger,
      target,
      value: point.value ?? 1,
      ...(temporary ? { temporary: true } : {}),
      ...(effect === "summon"
        ? {
            summon: {
              kind:
                point.summon === "Archer"
                  ? ("archer" as const)
                  : ("zombie" as const),
              attack: point.attack!,
              health: point.health!,
              level: point.summonLevel!,
            },
          }
        : {}),
    };
  });
  return {
    id: `${base.id}:${rarity}`,
    baseId: base.id,
    name: base.name,
    title: base.title,
    color: base.color,
    kind: base.kind,
    rarity,
    level,
    sourceHero: base.reference,
    attack: stats[0]! + (source.combatType === "building" ? 0 : bonus),
    health: stats[1]! + bonus * 2,
    combatType: source.combatType as CombatType,
    faction: source.faction as Faction,
    abilities,
  };
}
export const CATALOG: readonly CardDefinition[] = definitions.map((base) => {
  const {
    rarity: _rarity,
    level: _level,
    baseId: _baseId,
    ...card
  } = build(base, "common", 1);
  return { ...card, id: base.id };
});
export const DEFAULT_DECK = [
  "guardian:common",
  "turtle:common",
  "mushroom:common",
  "wisp:common",
];

export function variantCard(
  baseId: string,
  rarity: CardRarity,
  level = 1,
): CardDefinition {
  const base = definitions.find((card) => card.id === baseId);
  if (
    !base ||
    !RARITIES.includes(rarity) ||
    !Number.isInteger(level) ||
    level < 1 ||
    level > MAX_CARD_LEVEL
  )
    throw new GameError("Cette variante de carte n’existe pas.");
  return build(base, rarity, level);
}
export function cloneCard(card: CardDefinition): CardDefinition {
  return {
    ...card,
    ...(card.abilities
      ? {
          abilities: card.abilities.map((a) => ({
            ...a,
            ...(a.summon ? { summon: { ...a.summon } } : {}),
          })),
        }
      : {}),
  };
}
export function resolveCard(id: string, level = 1): CardDefinition {
  if (!id.includes(":")) {
    const base = CATALOG.find((c) => c.id === id);
    if (!base)
      throw new GameError("Cette carte n’existe pas dans le catalogue.");
    const card = variantCard(id, "common", level);
    return { ...card, id };
  }
  const [baseId, rarity, extra] = id.split(":");
  if (extra !== undefined)
    throw new GameError("Cette variante de carte n’existe pas.");
  return variantCard(baseId!, rarity as CardRarity, level);
}
function cost(level: number, rarity: CardRarity, column: number) {
  if (
    !Number.isInteger(level) ||
    level < 1 ||
    level > MAX_CARD_LEVEL ||
    !RARITIES.includes(rarity)
  )
    throw new GameError("Ce niveau d’amélioration n’existe pas.");
  return level === MAX_CARD_LEVEL ? 0 : data.costs[rarity][level]![column]!;
}
export function upgradeCost(level: number, rarity: CardRarity = "common") {
  return cost(level, rarity, 0);
}
export function upgradeGoldCost(level: number, rarity: CardRarity = "common") {
  return cost(level, rarity, 1);
}
export function baseCardId(card: CardDefinition) {
  return card.baseId ?? card.id.split(":")[0]!;
}
export function getCombatType(card: CardDefinition): CombatType {
  return (
    card.combatType ??
    CATALOG.find((c) => c.id === baseCardId(card))?.combatType ??
    "melee"
  );
}
export function combatTypeLabel(card: CardDefinition) {
  return { melee: "Corps à corps", ranged: "À distance", building: "Bâtiment" }[
    getCombatType(card)
  ];
}
