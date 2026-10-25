import { cardsOfRarity, RARITIES, type CardRarity } from "./index";
import type { LootReveal, LootStack } from "./progression";
import { leagueAt } from "./leagues";
import { rewardLeague, rewardRow, rollReward } from "./reward-tables";
import ancientsReference from "./data/ancients-summoning.json";
import sylveReference from "./data/sylve-summoning.json";

export const WELCOME_DIAMONDS = 3_000;
export type SummonPackId = "sylve" | "ancients" | "divine";
export type SummonCount = 1 | 10;
export const HEROES_PER_SUMMON = 5;
export const SUMMON_REVEAL_SLOTS = 6;

export interface SummonPack {
  id: SummonPackId;
  enabled: boolean;
  name: string;
  description: string;
  price: number;
  tenPrice: number;
  repeatPrices: readonly number[];
  repeatTenPrices: readonly number[];
  guaranteedLegendaries: number;
  guaranteedPerSummon?: number;
  legendaryBoostChance?: number;
  rates: Record<CardRarity, number>;
}

export const SUMMON_PACKS: readonly SummonPack[] = [
  {
    id: "sylve",
    enabled: true,
    name: "Appel de la Sylve",
    description:
      "Cinq compagnons rares, épiques ou légendaires et une carte d’or en bonus.",
    price: 149,
    tenPrice: 1_299,
    repeatPrices: [139, 129],
    repeatTenPrices: [1_149, 999],
    guaranteedLegendaries: 1,
    rates: { common: 0, rare: 82, epic: 16, legendary: 2 },
  },
  {
    id: "ancients",
    enabled: true,
    name: "Appel des anciens",
    description:
      "Cinq compagnons, dont au moins deux légendaires, et une carte d’or en bonus.",
    price: 4_999,
    tenPrice: 44_999,
    repeatPrices: [4_749, 4_499],
    repeatTenPrices: [39_999, 34_999],
    guaranteedLegendaries: 20,
    guaranteedPerSummon: 2,
    legendaryBoostChance: 0.5,
    rates: { common: 0, rare: 0, epic: 54, legendary: 46 },
  },
  {
    id: "divine",
    enabled: false,
    name: "Appel des divinités",
    description:
      "Cinq légendaires, une carte d’or et une chance de doubler un compagnon.",
    price: 4_499,
    tenPrice: 39_999,
    repeatPrices: [4_049],
    repeatTenPrices: [35_999],
    guaranteedLegendaries: 50,
    rates: { common: 0, rare: 0, epic: 0, legendary: 100 },
  },
];

export const ACTIVE_SUMMON_PACKS = SUMMON_PACKS.filter((pack) => pack.enabled);

export interface SummonResult {
  requestId: string;
  packId: SummonPackId;
  count: SummonCount;
  cost: number;
  reveals: LootReveal[];
  gold?: number;
  /** One frozen gold reward for each invocation, in reveal order. */
  goldBySummon?: number[];
  /** Ephemeral permission returned only to the purchase's open reveal circle. */
  repeatToken?: string;
  revealProgress?: SummonRevealProgress;
  /** Missing on legacy draws, which are treated as already viewed. */
  revealCompleted?: boolean;
}

export interface SummonRevealProgress {
  round: number;
  revealed: number[];
}

export type SummonReward =
  | { kind: "hero"; item: LootReveal }
  | { kind: "gold"; amount: number };

/** Stable positions keep resumed cards and their reveal markers aligned. */
export function summonRoundRewards(
  result: SummonResult,
  round: number,
): SummonReward[] {
  const rewards: SummonReward[] = result.reveals
    .slice(round * HEROES_PER_SUMMON, (round + 1) * HEROES_PER_SUMMON)
    .map((item) => ({ kind: "hero", item }));
  const total = result.gold ?? 0;
  const gold =
    result.goldBySummon?.[round] ??
    Math.floor(total / result.count) + (round < total % result.count ? 1 : 0);
  if (gold > 0) rewards.push({ kind: "gold", amount: gold });
  let seed = 2166136261;
  for (const char of `${result.requestId}:${round}`)
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  for (let i = rewards.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [rewards[i], rewards[j]] = [rewards[j]!, rewards[i]!];
  }
  return rewards;
}

export function mergeSummonProgress(
  current?: SummonRevealProgress,
  update?: SummonRevealProgress,
): SummonRevealProgress {
  return {
    round: Math.max(current?.round ?? 0, update?.round ?? 0),
    revealed: [
      ...new Set([...(current?.revealed ?? []), ...(update?.revealed ?? [])]),
    ].sort((a, b) => a - b),
  };
}

export function summonRevealIndices(result: SummonResult): number[] {
  return Array.from({ length: result.count }, (_, round) =>
    summonRoundRewards(result, round).map(
      (_, index) => round * SUMMON_REVEAL_SLOTS + index,
    ),
  ).flat();
}

export function summonRevealComplete(
  result: SummonResult,
  progress: SummonRevealProgress,
): boolean {
  const revealed = new Set(progress.revealed);
  return summonRevealIndices(result).every((index) => revealed.has(index));
}

export interface SummonOffer {
  packId: SummonPackId;
  count: SummonCount;
  baseCost: number;
  cost: number;
}

export function summonPack(id: SummonPackId): SummonPack {
  const pack = SUMMON_PACKS.find((entry) => entry.id === id);
  if (!pack) throw new Error("Ce pack d’invocation n’existe pas.");
  return pack;
}

export function summonPrice(id: SummonPackId, count: SummonCount): number {
  if (count !== 1 && count !== 10)
    throw new Error("Choisis une ou dix invocations.");
  const pack = summonPack(id);
  return count === 10 ? pack.tenPrice : pack.price;
}

/** Only an active reveal circle can offer the repeat discount. */
export function summonOffer(
  packId: SummonPackId,
  count: SummonCount,
  repeat = false,
  previousCost?: number,
): SummonOffer {
  const baseCost = summonPrice(packId, count);
  const pack = summonPack(packId);
  const prices = count === 10 ? pack.repeatTenPrices : pack.repeatPrices;
  const step = prices.indexOf(previousCost ?? baseCost) + 1;
  const repeatPrice = prices[Math.min(step, prices.length - 1)]!;
  return {
    packId,
    count,
    baseCost,
    cost: repeat ? repeatPrice : baseCost,
  };
}

export function summonQuantity(
  id: SummonPackId,
  rarity: CardRarity,
  peakTrophies = 0,
  legendarySize: 1 | 2 = 1,
) {
  if (summonPack(id).rates[rarity] === 0)
    throw new Error("Rareté absente de cette invocation.");
  if (id === "sylve") {
    const row =
      sylveReference.leagues[
        rewardLeague(peakTrophies) as keyof typeof sylveReference.leagues
      ];
    const range = row[RARITIES.indexOf(rarity) - 1]!;
    return { min: range[0]!, max: range[1] ?? range[0]! };
  }
  if (id === "ancients") {
    if (rarity !== "epic" && rarity !== "legendary")
      throw new Error("Rareté absente de cette invocation.");
    const row =
      ancientsReference.leagues[
        rewardLeague(peakTrophies) as keyof typeof ancientsReference.leagues
      ];
    const range = row[rarity === "epic" ? 0 : legendarySize]!;
    return { min: range[0]!, max: range[1]! };
  }
  const range = rewardRow("gods", peakTrophies)[0]!;
  return { min: range[0]!, max: range[1] ?? range[0]! };
}

export function summonGoldQuantity(peakTrophies = 0) {
  const index = leagueAt(peakTrophies).index;
  return { min: 500 + index * 50, max: 1000 + index * 100 };
}

/** Gold is an additional reward; it never replaces a companion or a rarity roll. */
export function summonGold(
  id: SummonPackId,
  count: SummonCount,
  random: () => number,
  peakTrophies = 0,
) {
  return summonGoldRewards(id, count, random, peakTrophies).reduce(
    (sum, amount) => sum + amount,
    0,
  );
}

export function summonGoldRewards(
  id: SummonPackId,
  count: SummonCount,
  random: () => number,
  peakTrophies = 0,
) {
  summonPrice(id, count);
  const range = summonGoldQuantity(peakTrophies);
  return Array.from({ length: count }, () =>
    rollReward([range.min, range.max], random),
  );
}

/** Published rarity rates include the Ancients' two guaranteed stacks per round. */
export function summonLoot(
  id: SummonPackId,
  count: SummonCount,
  random: () => number,
  peakTrophies = 0,
): LootStack[] {
  summonPrice(id, count);
  const pack = summonPack(id);
  const rollRarity = (): CardRarity => {
    let roll = random() * 100;
    for (const rarity of RARITIES) {
      roll -= pack.rates[rarity];
      if (roll < 0) return rarity;
    }
    return "legendary";
  };
  const total = count * HEROES_PER_SUMMON;
  const doubles =
    id === "divine"
      ? Array.from({ length: count }, () =>
          random() < 0.5 ? Math.floor(random() * HEROES_PER_SUMMON) : -1,
        )
      : [];
  const rollStack = (
    rarity: CardRarity,
    legendarySize: 1 | 2 = 1,
  ): LootStack => {
    const range = summonQuantity(id, rarity, peakTrophies, legendarySize);
    const copies = rollReward([range.min, range.max], random);
    const pool = cardsOfRarity(rarity);
    return {
      variantId:
        pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]!.id,
      count: copies,
    };
  };
  if (id === "ancients") {
    const guaranteed = pack.guaranteedPerSummon!;
    // Two fixed legendaries + three 10% rolls yield the advertised 46% overall.
    const extraLegendaryChance =
      (pack.rates.legendary * HEROES_PER_SUMMON - guaranteed * 100) /
      (HEROES_PER_SUMMON - guaranteed) /
      100;
    return Array.from({ length: total }, (_, index) => {
      const fixed = index % HEROES_PER_SUMMON < guaranteed;
      const rarity =
        fixed || random() < extraLegendaryChance ? "legendary" : "epic";
      const size = fixed && random() < pack.legendaryBoostChance! ? 2 : 1;
      return rollStack(rarity, size);
    });
  }
  const loot = Array.from({ length: total }, (_, index) => {
    const stack = rollStack(id === "divine" ? "legendary" : rollRarity());
    if (
      doubles[Math.floor(index / HEROES_PER_SUMMON)] ===
      index % HEROES_PER_SUMMON
    )
      stack.count *= 2;
    return stack;
  });
  if (count === 10) {
    const candidates = loot.flatMap((entry, index) =>
      entry.variantId.endsWith(":legendary") ? [] : [index],
    );
    const missing = pack.guaranteedLegendaries - (total - candidates.length);
    for (let i = 0; i < missing; i++) {
      const [slot] = candidates.splice(
        Math.floor(random() * candidates.length),
        1,
      );
      loot[slot!] = rollStack("legendary");
    }
  }
  return loot;
}
