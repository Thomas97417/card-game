import type { Faction } from "./cards";
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
    portrait: "/art/heroes/hero-north.webp",
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
    portrait: "/art/heroes/hero-maestro.webp",
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
    portrait: "/art/heroes/hero-shaman.webp",
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
    portrait: "/art/heroes/hero-winter.webp",
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
    portrait: "/art/heroes/hero-moon.webp",
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
    portrait: "/art/heroes/hero-shadow.webp",
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
    portrait: "/art/heroes/hero-flame.webp",
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
