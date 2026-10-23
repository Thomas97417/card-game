import { CATALOG, RARITIES, type CardRarity } from "./index";
import type { LootReveal, LootStack } from "./progression";

export const WELCOME_DIAMONDS = 3_000;
export type SummonPackId = "sylve" | "ancients";
export type SummonCount = 1 | 10;

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
    description: "La forêt recèle des alliés de toutes les raretés.",
    price: 149,
    tenPrice: 1_299,
    guaranteedLegendaries: 1,
    rates: { common: 65, rare: 25, epic: 8, legendary: 2 },
  },
  {
    id: "ancients",
    name: "Appel des anciens",
    description: "Les esprits les plus précieux répondent à ton appel.",
    price: 449,
    tenPrice: 3_899,
    guaranteedLegendaries: 2,
    rates: { common: 0, rare: 0, epic: 80, legendary: 20 },
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

/** Base rates apply to singles; ten-packs upgrade random non-legendary slots if needed. */
export function summonLoot(
  id: SummonPackId,
  count: SummonCount,
  random: () => number,
): LootStack[] {
  summonPrice(id, count);
  const pack = summonPack(id);
  const rollVariant = (rarity: CardRarity) =>
    `${CATALOG[Math.floor(random() * CATALOG.length)]!.id}:${rarity}`;
  const loot = Array.from({ length: count }, () => {
    let roll = random() * 100;
    let selected: CardRarity = "legendary";
    for (const rarity of RARITIES) {
      roll -= pack.rates[rarity];
      if (roll < 0) {
        selected = rarity;
        break;
      }
    }
    return { variantId: rollVariant(selected), count: 1 };
  });
  if (count === 10) {
    const candidates = loot.flatMap((entry, index) =>
      entry.variantId.endsWith(":legendary") ? [] : [index],
    );
    const missing = pack.guaranteedLegendaries - (count - candidates.length);
    for (let i = 0; i < missing; i++) {
      const [slot] = candidates.splice(
        Math.floor(random() * candidates.length),
        1,
      );
      loot[slot!] = { variantId: rollVariant("legendary"), count: 1 };
    }
  }
  return loot;
}
