import data from "./data/cunt-wars.json";
import evolutionNames from "./data/evolution-names.json";
import legendaryNames from "./data/legendary-names.json";
import { GameError } from "./errors";
import type {
  CardAbility,
  CardDefinition,
  CardRarity,
} from "./cards";

export interface SoulbindRequirement {
  variantId: string;
  sourceHero: string;
  level: number;
  adaptedFrom?: string;
}
export interface SoulbindDefinition {
  tier: number;
  rank: number;
  requirements: SoulbindRequirement[];
  attack: number;
  health: number;
  might: number;
}
interface SkillPoint {
  level: number;
  value?: number;
  valueMax?: number;
  count?: number;
  attack?: number;
  health?: number;
  summon?: NonNullable<CardAbility["summon"]>["kind"];
  summonName?: string;
  summonLevel?: number;
  profileId?: string;
}
interface SourceSkill extends Omit<
  CardAbility,
  "name" | "active" | "value" | "description" | "summon"
> {
  descriptionFr: string;
  progression: SkillPoint[];
  placement?: NonNullable<CardAbility["summon"]>["placement"];
}
export interface CwProfile {
  name: string;
  baseId: string;
  rarity: CardRarity;
  faction: NonNullable<CardDefinition["faction"]>;
  combatType: NonNullable<CardDefinition["combatType"]>;
  gender: NonNullable<CardDefinition["gender"]>;
  stats: number[][];
  skills: SourceSkill[];
  soulbinds: SoulbindDefinition[];
  evolutions: { variantId: string; cost: number; count: number }[];
  source: string;
}
interface TokenProfile {
  id: string;
  name: string;
  artId: string;
  kind: string;
  faction: CardDefinition["faction"];
  combatType: CardDefinition["combatType"];
  gender: CardDefinition["gender"];
  levels: {
    level: number;
    minionLevel: number;
    attack: number;
    health: number;
    skills: (Omit<
      CardAbility,
      "name" | "active" | "unlockLevel" | "description"
    > & { descriptionFr: string })[];
  }[];
}
export const CW_CATALOGUE = data.cards as unknown as readonly CwProfile[];
export const CW_TOKENS = data.tokens.map((token) => ({
  ...token,
  name:
    token.artId === "root-coil"
      ? "Tourelle du chapitre"
      : token.artId === "life-palace"
        ? "Chapelle consacrée"
        : token.name,
})) as unknown as readonly TokenProfile[];
const rarityOrder: CardRarity[] = ["common", "rare", "epic", "legendary"];
const families = data.families as Record<string, (string | null)[]>;
const profiles = new Map(
  CW_CATALOGUE.map((c) => [`${c.baseId}:${c.rarity}`, c]),
);

export function availableRarities(baseId: string): CardRarity[] {
  const forms = families[baseId];
  if (!forms) throw new GameError("Cette famille n’existe pas.");
  return rarityOrder.filter((_, index) => forms[index] != null);
}
/** Historical common IDs remain readable; new rewards only use real CW forms. */
export function canonicalVariantId(id: string) {
  const [baseId, requested = "common", extra] = id.split(":");
  if (
    !baseId ||
    extra !== undefined ||
    !rarityOrder.includes(requested as CardRarity)
  )
    throw new GameError("Cette variante de carte n’existe pas.");
  const rarities = availableRarities(baseId);
  const rarity = rarities.includes(requested as CardRarity)
    ? requested
    : rarities[0];
  return `${baseId}:${rarity}`;
}
export function cardSource(id: string): CwProfile {
  const card = profiles.get(canonicalVariantId(id));
  if (!card) throw new GameError("Cette variante de carte n’existe pas.");
  return card;
}
export const effectNames: Record<CardAbility["effect"], string> = {
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
  attack_per_ally: "Puissance de formation",
  health_per_ally: "Vitalité de formation",
  heal_full: "Soin intégral",
  damage: "Dégâts magiques",
  poison: "Poison",
  steal_attack: "Vol d’attaque",
  attack_rune: "Rune de puissance",
  cleanse: "Purification",
  silence: "Silence",
  drain: "Drain de vie",
  counter_attack: "Contre-attaque",
  immunity: "Immunité",
  evasion: "Esquive",
  set_attack: "Entrave",
  attack_curse: "Malédiction",
  hero_damage_from_health: "Écho vital",
  poison_enemy: "Empoisonnement",
  splash: "Dégâts de zone",
  reflect_damage: "Reflet des dégâts",
  attack_pentagram: "Pentagramme de puissance",
  health_pentagram: "Pentagramme de vie",
};

export function cwAbility(skill: SourceSkill, level: number): CardAbility {
  const point =
    [...skill.progression].reverse().find((p) => p.level <= level) ??
    skill.progression[0]!;
  const { progression: _, descriptionFr, placement, ...mechanics } = skill;
  return {
    ...mechanics,
    name:
      skill.effect === "attack" && (point.value ?? 0) < 0
        ? "Affaiblissement"
        : skill.effect === "attack_per_ally" && skill.target === "order_allies"
          ? "Alliance de l’Ordre"
          : effectNames[skill.effect],
    description: descriptionFr
      .replaceAll("Bobine des racines", "Tourelle du chapitre")
      .replaceAll("Autel des sources", "Chapelle consacrée")
      .replace(/\{(\w+)\}/g, (_, key: string) =>
        String(
          key === "count"
            ? (point.count ?? skill.count ?? 1)
            : (point[key as keyof SkillPoint] ?? ""),
        ),
      )
      .replace(/\b1 dégâts\b/g, "1 dégât")
      .replace(
        /(\d+) pentagramme\(s\)/g,
        (_, n: string) => `${n} pentagramme${Number(n) > 1 ? "s" : ""}`,
      )
      .replace(
        /(\d+) Éclaireur des braises/g,
        (_, n: string) =>
          `${n} Éclaireur${Number(n) > 1 ? "s" : ""} des braises`,
      ),
    active: level >= skill.unlockLevel,
    value: point.value ?? 1,
    ...(point.valueMax !== undefined ? { valueMax: point.valueMax } : {}),
    ...(point.count !== undefined ? { count: point.count } : {}),
    ...(point.summon
      ? {
          summon: {
            kind: point.summon,
            profileId: point.profileId,
            placement,
            attack: point.attack!,
            health: point.health!,
            level: point.summonLevel!,
          },
        }
      : {}),
  };
}
interface Identity {
  id: string;
  name: string;
  title: string;
  color: string;
  kind: string;
}
export function buildCwCard(
  base: Identity,
  rarity: CardRarity,
  level: number,
  activated: readonly number[] = [],
): CardDefinition {
  const source = profiles.get(`${base.id}:${rarity}`);
  if (
    !source ||
    !Number.isInteger(level) ||
    level < 1 ||
    level > source.stats.length
  )
    throw new GameError("Cette variante ou ce niveau de carte n’existe pas.");
  const soulbinds = [...new Set(activated)].sort((a, b) => a - b);
  if (soulbinds.some((tier) => !Number.isInteger(tier) || tier < 1 || tier > 4))
    throw new GameError("Ce lien d’âme n’existe pas.");
  const bonuses = source.soulbinds.filter((s) => soulbinds.includes(s.tier));
  const sum = (stat: "attack" | "health" | "might") =>
    bonuses.reduce((total, s) => total + s[stat], 0);
  const names = evolutionNames as Record<
    string,
    Partial<Record<CardRarity, string>>
  >;
  const legendary = legendaryNames as Record<string, string>;
  return {
    id: `${base.id}:${rarity}`,
    baseId: base.id,
    name:
      rarity === "legendary"
        ? (legendary[base.id] ?? base.name)
        : (names[base.id]?.[rarity] ?? base.name),
    title: base.title,
    color: base.color,
    kind: base.kind,
    rarity,
    level,
    rulesVersion: 2,
    sourceHero: source.name,
    gender: source.gender,
    combatType: source.combatType,
    faction: source.faction,
    ...(rarity !== "common" &&
    !(rarity === "legendary" && ["idol", "tree"].includes(base.id))
      ? { artId: `evolutions/${base.id}-${rarity}` }
      : {}),
    attack: source.stats[level - 1]![0]! + sum("attack"),
    health: source.stats[level - 1]![1]! + sum("health"),
    might:
      { common: 100, rare: 120, epic: 200, legendary: 350 }[rarity] +
      data.upgrade[rarity].slice(1, level).reduce((n, row) => n + row[3]!, 0) +
      sum("might"),
    abilities: source.skills.map((skill) => cwAbility(skill, level)),
    ...(soulbinds.length ? { soulbinds } : {}),
  };
}
export function cwUpgradeCost(
  level: number,
  rarity: CardRarity,
  column: number,
) {
  if (
    !Number.isInteger(level) ||
    level < 1 ||
    level > 26 ||
    !rarityOrder.includes(rarity)
  )
    throw new GameError("Ce niveau d’amélioration n’existe pas.");
  return level === 26 ? 0 : data.upgrade[rarity][level]![column]!;
}
