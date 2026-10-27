import warlords from "./data/warlords.json";
import type { CardAbility, CardDefinition, Faction } from "./cards";
import { GameError } from "./errors";

export const HERO_IDS = [
  "sylve",
  "thorn",
  "weaver",
  "void",
  "north",
  "maestro",
  "shaman",
  "winter",
  "moon",
  "shadow",
  "flame",
] as const;
export type HeroId = (typeof HERO_IDS)[number];
export const DEFAULT_HERO_ID: HeroId = "sylve";
export interface HeroDefinition {
  id: HeroId;
  name: string;
  subtitle: string;
  family: "sylve" | "thorn" | "weaver" | "void";
  faction: Faction;
  emeraldCost: number;
  requiredTrophies: number;
  portrait: string;
  sourceName: string;
}
export const HEROES: readonly HeroDefinition[] = [
  {
    id: "sylve",
    name: "Gardien de la Sylve",
    subtitle: "Le protecteur de ton alliance.",
    family: "sylve",
    faction: "order",
    emeraldCost: 0,
    requiredTrophies: 0,
    portrait: "/art/heroes/hero-sylve.webp",
    sourceName: "Adam",
  },
  {
    id: "thorn",
    name: "Gardien des Ronces",
    subtitle: "Les épines protègent, la forêt riposte.",
    family: "thorn",
    faction: "nature",
    emeraldCost: 5000,
    requiredTrophies: 1000,
    portrait: "/art/heroes/hero-thorn.webp",
    sourceName: "Son of Woods",
  },
  {
    id: "weaver",
    name: "Tisseuse du Crépuscule",
    subtitle: "Le poison prépare le coup de grâce.",
    family: "weaver",
    faction: "chaos",
    emeraldCost: 5500,
    requiredTrophies: 1400,
    portrait: "/art/heroes/hero-weaver.webp",
    sourceName: "Trixy, the Spider Queen",
  },
  {
    id: "void",
    name: "Gardien du Vide",
    subtitle: "Le froid suspend les assauts ennemis.",
    family: "void",
    faction: "nature",
    emeraldCost: 5500,
    requiredTrophies: 1800,
    portrait: "/art/heroes/hero-void.webp",
    sourceName: "Void Spirit",
  },
  {
    id: "north",
    name: "Gardien du Givre",
    subtitle: "Une garde de chevaliers au cœur de l’hiver.",
    family: "sylve",
    faction: "order",
    emeraldCost: 4500,
    requiredTrophies: 0,
    portrait: "/art/characters/evolutions/guardian-legendary.webp",
    sourceName: "Adam, King of the North",
  },
  {
    id: "maestro",
    name: "Maestra des Clairières",
    subtitle: "Protège ses alliés et brise les lignes arrière.",
    family: "sylve",
    faction: "nature",
    emeraldCost: 7500,
    requiredTrophies: 3000,
    portrait: "/art/characters/evolutions/bard-legendary.webp",
    sourceName: "Jimmy Hard Cock",
  },
  {
    id: "shaman",
    name: "Chamane des Racines",
    subtitle: "Ses totems retournent les coups au héros ennemi.",
    family: "thorn",
    faction: "nature",
    emeraldCost: 5000,
    requiredTrophies: 800,
    portrait: "/art/characters/evolutions/tree-epic.webp",
    sourceName: "White Shaman",
  },
  {
    id: "winter",
    name: "Artificier des Neiges",
    subtitle: "Des présents piégés et un second souffle.",
    family: "thorn",
    faction: "nature",
    emeraldCost: 7000,
    requiredTrophies: 3400,
    portrait: "/art/characters/evolutions/bear-legendary.webp",
    sourceName: "Ginger Overlord",
  },
  {
    id: "moon",
    name: "Souveraine Carmin",
    subtitle: "Une cour de vampires et de sorcières.",
    family: "weaver",
    faction: "chaos",
    emeraldCost: 7000,
    requiredTrophies: 4200,
    portrait: "/art/characters/evolutions/enchantress-legendary.webp",
    sourceName: "Oiran, Red Moon",
  },
  {
    id: "shadow",
    name: "Héraut des Ombres",
    subtitle: "L’ombre réduit les ennemis à l’impuissance.",
    family: "void",
    faction: "nature",
    emeraldCost: 5500,
    requiredTrophies: 3800,
    portrait: "/art/characters/evolutions/witch-legendary.webp",
    sourceName: "Harbinger of Darkness",
  },
  {
    id: "flame",
    name: "Émissaire des Braises",
    subtitle: "Punit les assauts et renforce la mêlée.",
    family: "void",
    faction: "nature",
    emeraldCost: 5500,
    requiredTrophies: 3000,
    portrait: "/art/characters/evolutions/dragon-legendary.webp",
    sourceName: "Rajan, Flaming",
  },
];
export function heroDefinition(id: HeroId = DEFAULT_HERO_ID): HeroDefinition {
  const hero = HEROES.find((hero) => hero.id === id);
  if (!hero) throw new GameError("Ce héros n’existe pas.");
  return hero;
}
export function heroPortrait(id?: HeroId, computer = false) {
  return id
    ? heroDefinition(id).portrait
    : `/art/heroes/hero-${computer ? "amber" : "sylve"}.webp`;
}
export function alternativeHeroLevels(id: HeroId) {
  return id === "sylve" ? null : warlords[id].levels;
}
export function maxHeroLevel(id: HeroId = DEFAULT_HERO_ID) {
  return alternativeHeroLevels(id)?.length ?? 91;
}

/** A complete summoned definition is snapshotted in the match, like other minions. */
export function heroMinion(
  id: HeroId,
  level: number,
  kind: string,
): CardDefinition {
  const row = alternativeHeroLevels(id)?.[level - 1];
  const skills = row?.skills ?? [];
  const stats =
    kind === "witch"
      ? skills[2]!
      : kind === "gift" || kind === "vampire"
        ? skills[0]!
        : skills[1]!;
  const [attack = 0, health = 1, extra = 0, fourth = 0] = stats;
  const ability = (
    effect: CardAbility["effect"],
    value: number,
    trigger: CardAbility["trigger"],
    target: CardAbility["target"],
    name: string,
    description: string,
  ): CardAbility => ({
    id: `${kind}-${effect}`,
    effect,
    value,
    trigger,
    target,
    name,
    description,
    active: true,
    unlockLevel: 1,
  });
  const definitions: Record<
    string,
    {
      name: string;
      art: string;
      type: CardDefinition["combatType"];
      faction: Faction;
      gender: CardDefinition["gender"];
      abilities: CardAbility[];
    }
  > = {
    knight: {
      name: "Chevalier du Givre",
      art: "guardian",
      type: "melee",
      faction: "order",
      gender: "male",
      abilities: [
        ability(
          "block",
          extra,
          "passive",
          "self",
          "Blocage",
          `Réduit les attaques physiques de ${extra} dégâts.`,
        ),
      ],
    },
    rocker: {
      name: "Chantre des Clairières",
      art: "bard",
      type: "ranged",
      faction: "order",
      gender: "male",
      abilities: [
        ability(
          "splash",
          extra,
          "passive",
          "adjacent_enemies",
          "Onde sonore",
          `${extra} dégâts aux ennemis voisins de la cible attaquée.`,
        ),
      ],
    },
    witch: {
      name: "Sorcière du Crépuscule",
      art: "witch",
      type: "ranged",
      faction: "chaos",
      gender: "female",
      abilities: [
        ability(
          "sacrifice",
          0,
          "turn_start",
          "self",
          "Éphémère",
          "Disparaît au début de ton prochain tour.",
        ),
      ],
    },
    demon: {
      name: "Esprit du Vide",
      art: "witch",
      type: "ranged",
      faction: "chaos",
      gender: "male",
      abilities: [
        ability(
          "freeze",
          1,
          "attack",
          "attack_target",
          "Toucher de givre",
          "Gèle la cible pour son prochain tour.",
        ),
      ],
    },
    shadow: {
      name: "Esprit des Ombres",
      art: "witch",
      type: "ranged",
      faction: "chaos",
      gender: "male",
      abilities: [
        {
          ...ability(
            "set_attack",
            1,
            "attack",
            "random_enemy",
            "Entrave",
            "Réduit à 1 l’attaque de deux ennemis aléatoires pendant leur prochain tour.",
          ),
          count: 2,
        },
      ],
    },
    ifrit: {
      name: "Esprit des Braises",
      art: "dragon",
      type: "melee",
      faction: "chaos",
      gender: "male",
      abilities: [
        ability(
          "damage",
          extra,
          "turn_end",
          "adjacent_enemies",
          "Brasier",
          `Inflige ${extra} dégâts aux ennemis autour de lui en fin de tour.`,
        ),
      ],
    },
    totem: {
      name: "Totem des Racines",
      art: "idol",
      type: "building",
      faction: "nature",
      gender: "sexless",
      abilities: [
        ability(
          "reflect_damage",
          0,
          "attacked",
          "enemy_hero",
          "Reflet",
          "Renvoie les dégâts subis au héros ennemi.",
        ),
      ],
    },
    gift: {
      name: "Présent piégé",
      art: "idol",
      type: "building",
      faction: "order",
      gender: "sexless",
      abilities: [
        ability(
          "damage",
          extra,
          "death",
          "line_enemies",
          "Présent explosif",
          `À sa mort, inflige ${extra} dégâts aux ennemis de sa ligne.`,
        ),
      ],
    },
    vampire: {
      name: "Ancêtre Carmin",
      art: "vampire",
      type: "melee",
      faction: "chaos",
      gender: "male",
      abilities: [
        ability(
          "vampirism",
          extra,
          "passive",
          "self",
          "Vampirisme",
          `Vole ${extra} PV lors des attaques.`,
        ),
        ability(
          "drain",
          fourth,
          "turn_end",
          "all_enemies",
          "Soif ancienne",
          `Draine ${fourth} PV à chaque ennemi en fin de tour.`,
        ),
      ],
    },
  };
  const spec = definitions[kind];
  if (!spec) throw new GameError("Ce renfort de héros n’existe pas.");
  return {
    id: `token-hero-${id}-${kind}-${level}`,
    name: spec.name,
    title: "Renfort du héros",
    kind,
    baseId: spec.art,
    artId: spec.art,
    color: "#b0c78f",
    attack: kind === "totem" ? 0 : attack,
    health: kind === "totem" ? 24 : health,
    combatType: spec.type,
    faction: spec.faction,
    gender: spec.gender,
    abilities: spec.abilities,
    level: 1,
    rarity: "common",
    rulesVersion: 2,
  };
}
