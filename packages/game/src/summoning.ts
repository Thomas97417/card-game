import { CATALOG, RARITIES, type CardRarity } from "./index";
import type { LootReveal, LootStack } from "./progression";
import { leagueAt } from "./leagues";
import { rewardRow, rollReward } from "./reward-tables";

export const WELCOME_DIAMONDS = 3_000;
export type SummonPackId = "sylve" | "ancients" | "divine";
export type SummonCount = 1 | 10;
export const HEROES_PER_SUMMON = 5;

export interface SummonPack {
  id: SummonPackId;
  name: string;
  description: string;
  price: number;
  tenPrice: number;
  repeatPrice: number;
  repeatTenPrice: number;
  guaranteedLegendaries: number;
  rates: Record<CardRarity, number>;
}

export const SUMMON_PACKS: readonly SummonPack[] = [
  {
    id: "sylve",
    name: "Appel de la Sylve",
    description:
      "Cinq compagnons de toutes les raretés et une carte d’or en bonus.",
    price: 149,
    tenPrice: 1_299,
    repeatPrice: 139,
    repeatTenPrice: 1_169,
    guaranteedLegendaries: 1,
    rates: { common: 65, rare: 25, epic: 8, legendary: 2 },
  },
  {
    id: "ancients",
    name: "Appel des anciens",
    description:
      "Cinq compagnons épiques ou légendaires et une carte d’or en bonus.",
    price: 449,
    tenPrice: 3_899,
    repeatPrice: 404,
    repeatTenPrice: 3_509,
    guaranteedLegendaries: 2,
    rates: { common: 0, rare: 0, epic: 80, legendary: 20 },
  },
  {
    id: "divine",
    name: "Appel des divinités",
    description:
      "Cinq légendaires, une carte d’or et une chance de doubler un compagnon.",
    price: 4_499,
    tenPrice: 39_999,
    repeatPrice: 4_049,
    repeatTenPrice: 35_999,
    guaranteedLegendaries: 50,
    rates: { common: 0, rare: 0, epic: 0, legendary: 100 },
  },
];

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
): SummonOffer {
  const baseCost = summonPrice(packId, count);
  const pack = summonPack(packId);
  return {
    packId,
    count,
    baseCost,
    cost: repeat
      ? count === 10
        ? pack.repeatTenPrice
        : pack.repeatPrice
      : baseCost,
  };
}

export function summonQuantity(
  id: SummonPackId,
  rarity: CardRarity,
  peakTrophies = 0,
) {
  const common = rarity === "common";
  const column = id === "divine" || common ? 0 : RARITIES.indexOf(rarity) - 1;
  const row = rewardRow(
    id === "divine" ? "gods" : common ? "mercenaries" : "demigods",
    peakTrophies,
  );
  const range = row[column];
  if (!range || summonPack(id).rates[rarity] === 0)
    throw new Error("Rareté absente de cette invocation.");
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

/** Base rarity rates apply in every league. Ten-packs upgrade only missing guarantees. */
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
  const rollStack = (rarity: CardRarity): LootStack => {
    const range = summonQuantity(id, rarity, peakTrophies);
    const copies = rollReward([range.min, range.max], random);
    return {
      variantId: `${CATALOG[Math.floor(random() * CATALOG.length)]!.id}:${rarity}`,
      count: copies,
    };
  };
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
