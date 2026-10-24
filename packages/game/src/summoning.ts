import { CATALOG, RARITIES, type CardRarity } from "./index";
import type { LootReveal, LootStack } from "./progression";
import { leagueAt } from "./leagues";
import { rewardRow, rollReward } from "./reward-tables";

export const WELCOME_DIAMONDS = 3_000;
export type SummonPackId = "sylve" | "ancients";
export type SummonCount = 1 | 10;
export const HEROES_PER_SUMMON = 5;

export interface SummonPack {
  id: SummonPackId;
  name: string;
  description: string;
  price: number;
  tenPrice: number;
  guaranteedLegendaries: number;
  rates: Record<CardRarity, number>;
}

export const SUMMON_PACKS: readonly SummonPack[] = [
  {
    id: "sylve",
    name: "Appel de la Sylve",
    description:
      "Cinq compagnons rares, épiques ou légendaires répondent à ton appel.",
    price: 149,
    tenPrice: 1_299,
    guaranteedLegendaries: 1,
    rates: { common: 0, rare: 82, epic: 16, legendary: 2 },
  },
  {
    id: "ancients",
    name: "Appel des anciens",
    description:
      "Cinq légendaires, avec une chance de doubler les exemplaires d’un compagnon.",
    price: 449,
    tenPrice: 3_899,
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

export function summonQuantity(
  id: SummonPackId,
  rarity: CardRarity,
  peakTrophies = 0,
) {
  const column = id === "ancients" ? 0 : RARITIES.indexOf(rarity) - 1;
  const row = rewardRow(id === "ancients" ? "gods" : "demigods", peakTrophies);
  const range = row[column];
  if (!range || summonPack(id).rates[rarity] === 0)
    throw new Error("Rareté absente de cette invocation.");
  return { min: range[0]!, max: range[1] ?? range[0]! };
}

/** Five heroes per summon; Demigods x10 contains exactly one legendary among 50. */
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
  const legendarySlot =
    id === "sylve" && count === 10 ? Math.floor(random() * total) : -1;
  const doubles =
    id === "ancients"
      ? Array.from({ length: count }, () =>
          random() < 0.5 ? Math.floor(random() * HEROES_PER_SUMMON) : -1,
        )
      : [];
  return Array.from({ length: total }, (_, index) => {
    let rarity: CardRarity;
    if (id === "ancients") rarity = "legendary";
    else if (count === 10)
      rarity =
        index === legendarySlot
          ? "legendary"
          : random() < 41 / 49
            ? "rare"
            : "epic";
    else if (leagueAt(peakTrophies).index >= 10) {
      // Four guaranteed rare heroes and a fifth with 10/80/10 rates.
      const roll = index === 4 ? random() : 0;
      rarity =
        index < 4 || roll < 0.1 ? "rare" : roll < 0.9 ? "epic" : "legendary";
    } else rarity = rollRarity();
    const range = summonQuantity(id, rarity, peakTrophies);
    const copies = rollReward([range.min, range.max], random);
    return {
      variantId: `${CATALOG[Math.floor(random() * CATALOG.length)]!.id}:${rarity}`,
      count:
        copies *
        (doubles[Math.floor(index / HEROES_PER_SUMMON)] ===
        index % HEROES_PER_SUMMON
          ? 2
          : 1),
    };
  });
}
