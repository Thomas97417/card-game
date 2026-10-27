import { cardsOfRarity, type CardRarity } from "./index";
import { leagueAt } from "./leagues";
import { CHEST_TYPES, chestPoolForLeague, type ChestType } from "./chest-types";
import { rewardLeague, rollReward } from "./reward-tables";
import chestReference from "./data/chest-rewards.json";

export { CHEST_TYPES, CHEST_POOL_VERSION, type ChestType } from "./chest-types";

export const CHEST_REWARD_VERSION = 3;

/** Two starting combat slots, three league unlocks and three purchased slots. */
export const CHEST_SLOTS = 2;
export const LEAGUE_CHEST_SLOTS = 5;
export const CHEST_SLOT_UNLOCKS = [
  { slot: 2, trophies: 800 },
  { slot: 3, trophies: 1600 },
  { slot: 4, trophies: 2400 },
] as const;
export const CHEST_SLOT_KEYS = [
  {
    slot: 5,
    name: "Clé de la Sylve",
    price: 500,
    image: "/art/keys/chest-key-1.webp",
  },
  {
    slot: 6,
    name: "Clé des anciens",
    price: 1000,
    image: "/art/keys/chest-key-2.webp",
  },
  {
    slot: 7,
    name: "Clé souveraine",
    price: 1500,
    image: "/art/keys/chest-key-3-v2.webp",
  },
] as const;
export const TOTAL_CHEST_SLOTS = LEAGUE_CHEST_SLOTS + CHEST_SLOT_KEYS.length;

export function unlockedChestSlots(
  peakTrophies = 0,
  purchasedSlots: readonly number[] = [],
) {
  const trophies = Number.isFinite(peakTrophies)
    ? Math.max(0, peakTrophies)
    : 0;
  return Array.from({ length: TOTAL_CHEST_SLOTS }, (_, slot) => slot).filter(
    (slot) =>
      slot < CHEST_SLOTS ||
      CHEST_SLOT_UNLOCKS.some(
        (unlock) => unlock.slot === slot && trophies >= unlock.trophies,
      ) ||
      CHEST_SLOT_KEYS.some(
        (key) => key.slot === slot && purchasedSlots.includes(slot),
      ),
  );
}

export const VICTORY_CHEST_WINS = 3;
export interface VictoryChestProgress {
  wins: number;
  requiredWins: number;
  cycle: number;
}
export const CHEST_LABELS: Record<ChestType, string> = {
  common: "Commun",
  rare: "Rare",
  bigRare: "grand coffre rare",
  epic: "Épique",
  legendary: "Légendaire",
};
export function chestName(type: ChestType) {
  return type === "bigRare"
    ? "Grand coffre rare"
    : `Coffre ${CHEST_LABELS[type].toLowerCase()}`;
}
export interface LootStack {
  variantId: string;
  count: number;
}
export interface LootReveal extends LootStack {
  isNew: boolean;
  level: number;
  copies: number;
}
export interface ChestCardReward {
  rarity: CardRarity;
  chance: number;
  min: number;
  max: number;
}

type ChestRewardRow = Partial<Record<CardRarity, readonly number[]>> & {
  gold: readonly number[];
};

/** CW PC-browser rewards; the three-win chest shares our common chest table. */
export function chestRules(type: ChestType, trophies = 0) {
  const index = leagueAt(trophies).index;
  const early = index < 10;
  const tableId = type === "common" && index < 5 ? "wooden" : type;
  const table: Record<string, ChestRewardRow> = chestReference.tables[tableId];
  const league = rewardLeague(trophies);
  // Keep inherited chests openable even below their new drop threshold.
  const firstLeague = Math.max(
    ...Object.keys(table).filter((key) => key !== "GM").map(Number),
  );
  const row =
    table[
      league === "GM" ? league : String(Math.min(Number(league), firstLeague))
    ]!;
  const cards: ChestCardReward[] = [];
  function add(rarity: CardRarity, chance: number) {
    const range = row[rarity];
    if (range && chance > 0)
      cards.push({
        rarity,
        chance,
        min: range[0]!,
        max: range[1] ?? range[0]!,
      });
  }
  if (type === "common") {
    add("common", 95);
    add("rare", 4.75);
    add("epic", 0.25);
  } else if (type === "rare" || type === "bigRare") {
    const epicChance = early ? (type === "rare" ? 0.5 : 1) : 5;
    add("rare", 100 - epicChance);
    add("epic", epicChance);
  } else if (type === "epic") {
    add("epic", 99.75);
    add("legendary", 0.25);
  } else add("legendary", 100);
  const gold = row.gold;
  return {
    ...chestReference.opening[tableId],
    cards,
    min: cards[0]!.min,
    max: cards[0]!.max,
    minGold: gold[0]!,
    maxGold: gold[1] ?? gold[0]!,
  };
}

export const CHEST_RULES = Object.fromEntries(
  CHEST_TYPES.map((type) => [type, chestRules(type)]),
) as Record<ChestType, ReturnType<typeof chestRules>>;

export function chestPool(trophies = 0) {
  return chestPoolForLeague(leagueAt(trophies).index);
}

export function rollChest(
  random: () => number,
  trophies = 0,
  remaining = chestPool(trophies),
): ChestType {
  const initial = chestPool(trophies);
  const eligible = Object.fromEntries(
    CHEST_TYPES.map((type) => [type, initial[type] > 0 ? remaining[type] : 0]),
  ) as Record<ChestType, number>;
  const pool = Object.values(eligible).some((count) => count > 0)
    ? eligible
    : initial;
  let roll =
    random() * Object.values(pool).reduce((sum, count) => sum + count, 0);
  for (const type of CHEST_TYPES) {
    roll -= pool[type];
    if (roll < 0) return type;
  }
  return [...CHEST_TYPES].reverse().find((type) => pool[type] > 0)!;
}

/** The displayed quote is an upper bound; the server recalculates at purchase time. */
export function chestRushCost(
  chest: {
    rarity: ChestType;
    unlockAt: number;
    awardedAt?: number;
    instantCost?: number;
    leagueTrophies?: number;
  },
  now: number,
) {
  const remaining = chest.unlockAt - now;
  if (remaining <= 0) return 0;
  const rule = chestRules(chest.rarity, chest.leagueTrophies);
  const duration =
    chest.awardedAt === undefined
      ? rule.durationMs
      : chest.unlockAt - chest.awardedAt;
  const initial = chest.instantCost ?? rule.instantCost;
  return duration > 0
    ? Math.min(initial, Math.ceil((initial * remaining) / duration))
    : 0;
}
export function chestLoot(
  rarity: ChestType,
  random: () => number,
  trophies = 0,
): LootStack[] {
  const rule = chestRules(rarity, trophies);
  let roll = random() * 100;
  const card =
    rule.cards.find((entry) => (roll -= entry.chance) < 0) ??
    rule.cards[rule.cards.length - 1]!;
  const total = rollReward([card.min, card.max], random);
  const pool = cardsOfRarity(card.rarity);
  const chosen =
    pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]!;
  return [{ variantId: chosen.id, count: total }];
}

export function chestGold(
  rarity: ChestType,
  random: () => number,
  trophies = 0,
): number {
  const rule = chestRules(rarity, trophies);
  return rollReward([rule.minGold, rule.maxGold], random);
}
