import { CATALOG, RARITIES, type CardRarity } from "./index";

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
    weights: readonly number[];
  }
> = {
  common: {
    chance: 65,
    durationMs: 15 * 60_000,
    min: 4,
    max: 8,
    weights: [85, 13, 1.8, 0.2],
  },
  rare: {
    chance: 25,
    durationMs: 60 * 60_000,
    min: 12,
    max: 20,
    weights: [60, 30, 9, 1],
  },
  epic: {
    chance: 8,
    durationMs: 3 * 60 * 60_000,
    min: 30,
    max: 50,
    weights: [35, 35, 25, 5],
  },
  legendary: {
    chance: 2,
    durationMs: 8 * 60 * 60_000,
    min: 75,
    max: 110,
    weights: [10, 30, 40, 20],
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
export function rollChest(random: () => number): CardRarity {
  return weightedRarity(
    RARITIES.map((rarity) => CHEST_RULES[rarity].chance),
    random,
  );
}
export function chestLoot(
  rarity: CardRarity,
  random: () => number,
): LootStack[] {
  const rule = CHEST_RULES[rarity];
  const total = rule.min + Math.floor(random() * (rule.max - rule.min + 1));
  const stacks = new Map<string, number>();
  for (let i = 0; i < total; i++) {
    const cardRarity = i === 0 ? rarity : weightedRarity(rule.weights, random);
    const base = CATALOG[Math.floor(random() * CATALOG.length)]!;
    const id = `${base.id}:${cardRarity}`;
    stacks.set(id, (stacks.get(id) ?? 0) + 1);
  }
  return [...stacks].map(([variantId, count]) => ({ variantId, count }));
}
