import { GameError } from "./errors";
export { GameError } from "./errors";
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
export const FACTIONS: readonly Faction[] = ["order", "nature", "chaos"];
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
  | "reflect_damage"
  | "freeze"
  | "execute"
  | "sacrifice"
  | "set_health"
  | "block_rune";
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
  | "column_enemies"
  | "line_enemies"
  | "enemy_creatures"
  | "non_melee_enemies";
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
// Stable IDs keep collections and decks compatible when their artwork evolves.
const definitions = [
  {
    id: "guardian",
    name: "Gardien du rempart",
    title:
      "Animé par le serment des rois, ce colosse de pierre protège les portes de la citadelle sous son armure consacrée.",
    color: "#b6a16a",
    kind: "golem",
    reference: "Warrior",
  },
  {
    id: "fox",
    name: "Archère du bastion",
    title:
      "Depuis les créneaux du château, cette archère de la garde royale veille sur le royaume et décoche ses flèches au signal des cloches.",
    color: "#8b9cbb",
    kind: "fox",
    reference: "Archer",
  },
  {
    id: "owl",
    name: "Prêtresse de l’aurore",
    title:
      "Gardienne des reliques de la cathédrale, elle lit les présages dans les vitraux et accompagne les chevaliers de ses prières.",
    color: "#d4bd83",
    kind: "owl",
    reference: "Apprentice",
  },
  {
    id: "stag",
    name: "Pèlerine du serment",
    title:
      "Cette sœur en armure parcourt les routes du royaume, sa lance et son reliquaire consacrés à la défense des sanctuaires.",
    color: "#c1a267",
    kind: "stag",
    reference: "Pilgrim",
  },
  {
    id: "mushroom",
    name: "Dryade des fougères",
    title:
      "Née au creux d’un chêne ancien, cette dryade tisse les lianes et les floraisons pour défendre les clairières de la Sylve.",
    color: "#b4706b",
    kind: "mushroom",
    reference: "Dryad",
  },
  {
    id: "dragon",
    name: "Dragon d’ambre",
    title:
      "Ce dragon sylvestre veille sur la canopée. Ses écailles d’ambre recueillent la chaleur du soleil et son souffle réveille les graines endormies.",
    color: "#dbab52",
    kind: "dragon",
    reference: "Shaman",
  },
  {
    id: "turtle",
    name: "Tortue millénaire",
    title:
      "Les mousses et les roseaux ont élu refuge sur sa carapace. Elle garde les marais anciens avec la patience des plus vieux arbres.",
    color: "#83a575",
    kind: "turtle",
    reference: "Big Toad",
  },
  {
    id: "wisp",
    name: "Esprit des sources",
    title:
      "Cet esprit des bois porte la fraîcheur des sources et les secrets des druides. Partout où il passe, la forêt reprend vie.",
    color: "#70b7b1",
    kind: "wisp",
    reference: "Raven",
  },
  {
    id: "wolf",
    name: "Loup des abysses",
    title:
      "Des cornes d’obsidienne percent son pelage de cendres. Ce prédateur démoniaque traque les vivants au-delà des failles du Chaos.",
    color: "#ad554f",
    kind: "wolf",
    reference: "Red Orc",
  },
  {
    id: "knight",
    name: "Écuyer du royaume",
    title:
      "Élevé dans la cour du château, ce jeune écuyer porte l’épée et le bouclier de son ordre avec une loyauté sans faille.",
    color: "#879cb0",
    kind: "knight",
    reference: "Servant",
  },
  {
    id: "serpent",
    name: "Vipère infernale",
    title:
      "Cette démone serpentine surgit des autels interdits. Son venin brûlant et ses sortilèges se nourrissent des pactes du Chaos.",
    color: "#ae4b6c",
    kind: "serpent",
    reference: "Blood Cult Adept",
  },
  {
    id: "bear",
    name: "Ours des cimes",
    title:
      "Protecteur des vallées boisées, cet ours puissant répond à l’appel des druides et défend les siens à l’ombre des grands sapins.",
    color: "#b79780",
    kind: "bear",
    reference: "Lumberjack",
  },
  {
    id: "healer",
    name: "Féline des clairières",
    title:
      "Compagne des guérisseuses de la forêt, cette féline veille sur les bosquets sacrés et partage la vitalité des clairières avec ses alliés.",
    color: "#c6a478",
    kind: "cat",
    reference: "Cat Lady",
  },
  {
    id: "gnome",
    name: "Forgeron de la citadelle",
    title:
      "Dans les forges du château, cet artisan façonne les armes des chevaliers et scelle chaque ouvrage du poinçon de la couronne.",
    color: "#ac875a",
    kind: "gnome",
    reference: "Gnome",
  },
  {
    id: "idol",
    name: "Totem de l’aurore",
    title:
      "Sculpté dans le bois d’un arbre sacré, ce totem abrite un esprit de la Nature. Ses racines nourrissent les pousses de toute la clairière.",
    color: "#b5a46d",
    kind: "totem",
    reference: "Idol",
  },
  {
    id: "enchantress",
    name: "Enchanteresse du chapitre",
    title:
      "Au service du haut clergé, elle enlumine les grimoires et inscrit des sceaux de lumière sur les armes des défenseurs du royaume.",
    color: "#ad9ac4",
    kind: "mage",
    reference: "Love Lady",
  },
  {
    id: "lynx",
    name: "Lame du cloître",
    title:
      "Ce chevalier des ombres protège les secrets de l’abbaye. Sous sa cape, deux lames d’acier servent la justice de l’Ordre.",
    color: "#6c83a0",
    kind: "lynx",
    reference: "Shinobi",
  },
  {
    id: "bard",
    name: "Chantre de l’abbaye",
    title:
      "Les cantiques de l’abbaye accompagnent les armées de la couronne. Sa voix porte le courage des chevaliers jusque sous les murs ennemis.",
    color: "#c3a762",
    kind: "bird",
    reference: "Singer",
  },
  {
    id: "tree",
    name: "Saule des murmures",
    title:
      "Ses racines plongent jusqu’aux souvenirs du monde. Cet arbre vivant détourne les intrus des sentiers sacrés et protège les peuples de la forêt.",
    color: "#9b839e",
    kind: "tree",
    reference: "Tree",
  },
  {
    id: "vampire",
    name: "Vampire du néant",
    title:
      "Ce noble des cryptes abyssales développe ses ailes à mesure que ses pouvoirs grandissent. Ses griffes et sa soif de vie entretiennent la puissance des légions du Chaos.",
    color: "#9d496d",
    kind: "bat",
    reference: "Vampire",
  },
  {
    id: "captain",
    name: "Capitaine de la couronne",
    title:
      "Ancienne garde de rue au franc-parler mordant, elle mène les soldats de la couronne avec un sourire de défi. Son culot n’a d’égal que sa loyauté envers sa compagnie.",
    color: "#9d9fbc",
    kind: "captain",
    reference: "Warrioress",
  },
  {
    id: "witch",
    name: "Sorcière des enfers",
    title:
      "Cette ensorceleuse des cryptes du Néant tisse des maléfices pourpres et lie les créatures du Chaos à sa volonté. Son sceptre d’ivoire concentre une puissance toujours plus impérieuse.",
    color: "#ad527d",
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
