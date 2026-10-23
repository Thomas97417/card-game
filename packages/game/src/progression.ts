import { CATALOG, RARITIES, type CardRarity } from "./index";
import { leagueAt } from "./leagues";

/** Two combat-chest slots, one recurring victory chest and four locked slots. */
export const CHEST_SLOTS = 2;
export const LOCKED_CHEST_SLOTS = 4;
export const VICTORY_CHEST_WINS = 3;
export interface VictoryChestProgress {
  wins: number;
  requiredWins: number;
  cycle: number;
}
export const CHEST_LABELS: Record<CardRarity, string> = {
  common: "Commun",
  rare: "Rare",
  epic: "Épique",
  legendary: "Légendaire",
};
export interface LootStack {
  variantId: string;
  count: number;
}
export interface LootReveal extends LootStack {
  isNew: boolean;
  level: number;
  copies: number;
}
export const CHEST_RULES: Record<
  CardRarity,
  {
    chance: number;
    durationMs: number;
    min: number;
    max: number;
    minGold: number;
    maxGold: number;
  }
> = {
  common: {
    chance: 65,
    durationMs: 15 * 60_000,
    min: 8,
    max: 16,
    minGold: 40,
    maxGold: 80,
  },
  rare: {
    chance: 25,
    durationMs: 60 * 60_000,
    min: 24,
    max: 40,
    minGold: 120,
    maxGold: 200,
  },
  epic: {
    chance: 8,
    durationMs: 3 * 60 * 60_000,
    min: 60,
    max: 100,
    minGold: 300,
    maxGold: 500,
  },
  legendary: {
    chance: 2,
    durationMs: 8 * 60 * 60_000,
    min: 150,
    max: 220,
    minGold: 750,
    maxGold: 1100,
  },
};

function weightedRarity(
  weights: readonly number[],
  random: () => number,
): CardRarity {
  let value = random() * 100;
  for (let i = 0; i < RARITIES.length; i++) {
    value -= weights[i]!;
    if (value < 0) return RARITIES[i]!;
  }
  return "legendary";
}
export function rollChest(random: () => number, trophies = 0): CardRarity {
  const league = leagueAt(trophies);
  return weightedRarity(
    RARITIES.map((rarity) => league.chestChances[rarity]),
    random,
  );
}
export function chestLoot(
  rarity: CardRarity,
  random: () => number,
  trophies = 0,
): LootStack[] {
  const rule = CHEST_RULES[rarity];
  const multiplier = leagueAt(trophies).lootMultiplier;
  const min = Math.floor(rule.min * multiplier);
  const max = Math.floor(rule.max * multiplier);
  const total = min + Math.floor(random() * (max - min + 1));
  const base = CATALOG[Math.floor(random() * CATALOG.length)]!;
  return [{ variantId: `${base.id}:${rarity}`, count: total }];
}

export function chestGold(
  rarity: CardRarity,
  random: () => number,
  trophies = 0,
): number {
  const rule = CHEST_RULES[rarity];
  const multiplier = leagueAt(trophies).lootMultiplier;
  const min = Math.floor(rule.minGold * multiplier);
  const max = Math.floor(rule.maxGold * multiplier);
  return min + Math.floor(random() * (max - min + 1));
}
