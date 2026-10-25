import {
  buildCwCard,
  canonicalVariantId,
  availableRarities,
  cwUpgradeCost,
} from "./cw-catalogue";
export {
  canonicalVariantId,
  availableRarities,
  cardSource,
  CW_CATALOGUE,
  CW_TOKENS,
} from "./cw-catalogue";

export const MAX_CARD_LEVEL = 26;
export function maxCardLevel(_rarity: CardRarity = "common", _baseId?: string) {
  return MAX_CARD_LEVEL;
}
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
export const GENDER_LABELS = {
  male: "Masculin",
  female: "Féminin",
  sexless: "Neutre",
} as const;
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
  | "attack_per_ally"
  | "health_per_ally"
  | "heal_full"
  | "damage"
  | "poison"
  | "steal_attack"
  | "attack_rune"
  | "cleanse"
  | "silence"
  | "drain"
  | "counter_attack"
  | "immunity"
  | "evasion"
  | "set_attack"
  | "attack_curse"
  | "hero_damage_from_health"
  | "poison_enemy"
  | "splash"
  | "attack_pentagram"
  | "health_pentagram"
  | "reflect_damage";
export type AbilityTrigger =
  | "deploy"
  | "turn_start"
  | "nature_ally_appears"
  | "death"
  | "enemy_hero_attacked"
  | "ally_hero_attacked"
  | "turn_end"
  | "attack"
  | "attacked"
  | "ally_appears"
  | "ally_death"
  | "enemy_death"
  | "ally_healed"
  | "ally_block"
  | "ally_spikes"
  | "ally_vampirism"
  | "before_enemy_ranged_attack"
  | "before_attack"
  | "kill"
  | "enemy_appears"
  | "shield_lost"
  | "chaos_appears"
  | "ally_attacked"
  | "hero_attack"
  | "ally_regeneration"
  | "enemy_poison"
  | "before_enemy_melee_attack"
  | "any_death"
  | "passive"
  | "before_enemy_attack"
  | "order_ally_appears"
  | "ally_hero_healed";
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
  | "random_zombie"
  | "ranged_allies"
  | "chaos_allies"
  | "male_allies"
  | "adjacent_allies"
  | "nearby_allies"
  | "adjacent_heroes"
  | "nearby_heroes"
  | "allies_with_block"
  | "allies_with_vampirism"
  | "random_wounded_ally"
  | "event_ally"
  | "attack_target"
  | "enemy_hero"
  | "ranged_enemies"
  | "random_female_enemy"
  | "all_heroes"
  | "non_chaos_heroes"
  | "allies_with_shield"
  | "event_enemy"
  | "attacker"
  | "random_enemy"
  | "adjacent_enemies"
  | "nature_enemies"
  | "melee_enemies"
  | "random_column_ally"
  | "random_nature_ally"
  | "random_enemy_unit"
  | "female_allies"
  | "allies_with_summon"
  | "column_enemies";
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
  valueMax?: number;
  requiresVampirism?: boolean;
  fieldPlacement?: "melee";
  temporary?: boolean;
  count?: number;
  scaleBy?: AbilityTarget;
  includeSelf?: boolean;
  scaleIncludeSelf?: boolean;
  reactToSelf?: boolean;
  summon?: {
    kind:
      | "archer"
      | "zombie"
      | "squire"
      | "life_palace"
      | "tesla"
      | "leaf_child";
    profileId?: string;
    placement?: "behind" | "front" | "around" | "row" | "random_ranged";
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
  gender?: "male" | "female" | "sexless";
  artId?: string;
  abilities?: CardAbility[];
  baseId?: string;
  rarity?: CardRarity;
  level?: number;
  rulesVersion?: 2;
  might?: number;
  soulbinds?: number[];
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

export const CATALOG: readonly CardDefinition[] = definitions.map((base) => ({
  ...buildCwCard(base, availableRarities(base.id)[0]!, 1),
  id: base.id,
  name: base.name,
}));
export const CARD_VARIANTS: readonly CardDefinition[] = definitions.flatMap(
  (base) =>
    availableRarities(base.id).map((rarity) => buildCwCard(base, rarity, 1)),
);
export function cardsOfRarity(rarity: CardRarity) {
  return CARD_VARIANTS.filter((card) => card.rarity === rarity);
}
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
  soulbinds: readonly number[] = [],
): CardDefinition {
  const base = definitions.find((card) => card.id === baseId);
  if (!base) throw new GameError("Cette carte n’existe pas dans le catalogue.");
  return buildCwCard(base, rarity, level, soulbinds);
}
export function resolveCard(
  id: string,
  level = 1,
  soulbinds: readonly number[] = [],
): CardDefinition {
  const [baseId, rarity] = canonicalVariantId(id).split(":");
  const card = variantCard(baseId!, rarity as CardRarity, level, soulbinds);
  return id.includes(":") ? card : { ...card, id };
}
export function cloneCard(card: CardDefinition): CardDefinition {
  return {
    ...card,
    ...(card.soulbinds ? { soulbinds: [...card.soulbinds] } : {}),
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
export function upgradeCost(level: number, rarity: CardRarity = "common") {
  return cwUpgradeCost(level, rarity, 0);
}
export function upgradeGoldCost(level: number, rarity: CardRarity = "common") {
  return cwUpgradeCost(level, rarity, 1);
}
export function upgradeExperience(
  level: number,
  rarity: CardRarity = "common",
) {
  return cwUpgradeCost(level, rarity, 2);
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
