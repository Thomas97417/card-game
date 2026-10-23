import type { CardRarity } from "./index";

export const TROPHIES_PER_WIN = 25;
export const TROPHIES_PER_DIVISION = 200;

const TIERS = [
  { id: "iron", name: "Fer", chances: [65, 25, 8, 2] },
  { id: "bronze", name: "Bronze", chances: [58, 29, 10, 3] },
  { id: "silver", name: "Argent", chances: [50, 32, 14, 4] },
  { id: "gold", name: "Or", chances: [42, 34, 18, 6] },
  { id: "platinum", name: "Platine", chances: [35, 35, 22, 8] },
  { id: "emerald", name: "Émeraude", chances: [28, 36, 26, 10] },
  { id: "diamond", name: "Diamant", chances: [22, 36, 30, 12] },
  { id: "master", name: "Maître", chances: [18, 34, 33, 15] },
  { id: "grandmaster", name: "Grand maître", chances: [14, 32, 35, 19] },
  { id: "challenger", name: "Challenger", chances: [10, 30, 36, 24] },
] as const;

export interface League {
  id: string;
  index: number;
  tier: (typeof TIERS)[number]["id"];
  name: string;
  division: "IV" | "III" | "II" | "I";
  label: string;
  minTrophies: number;
  chestChances: Record<CardRarity, number>;
  lootMultiplier: number;
}

/** The last three prestige leagues each have one division. */
export const LEAGUES: readonly League[] = TIERS.flatMap((tier, tierIndex) => {
  const divisions =
    tierIndex < 7 ? (["IV", "III", "II", "I"] as const) : (["I"] as const);
  return divisions.map((division, divisionIndex) => {
    const index =
      tierIndex < 7 ? tierIndex * 4 + divisionIndex : 28 + tierIndex - 7;
    const next = TIERS[tierIndex + 1] ?? tier;
    const weights = tier.chances.map(
      (chance, i) => chance + ((next.chances[i]! - chance) * divisionIndex) / 4,
    );
    return {
      id: `${tier.id}-${division.toLowerCase()}`,
      index,
      tier: tier.id,
      name: tier.name,
      division,
      label: `${tier.name} ${division}`,
      minTrophies: index * TROPHIES_PER_DIVISION,
      chestChances: {
        common: weights[0]!,
        rare: weights[1]!,
        epic: weights[2]!,
        legendary: weights[3]!,
      },
      lootMultiplier: 1 + index * 0.05,
    };
  });
});

export const DECK_SLOT_UNLOCKS = [
  { slot: 5, trophies: 200 },
  { slot: 6, trophies: 800 },
  { slot: 7, trophies: 1600 },
  { slot: 8, trophies: 2400 },
] as const;

export function leagueAt(trophies: number): League {
  const safe = Number.isFinite(trophies)
    ? Math.max(0, Math.floor(trophies))
    : 0;
  return LEAGUES[
    Math.min(Math.floor(safe / TROPHIES_PER_DIVISION), LEAGUES.length - 1)
  ]!;
}

export function deckCapacity(trophies: number): number {
  return (
    4 + DECK_SLOT_UNLOCKS.filter((unlock) => trophies >= unlock.trophies).length
  );
}

export function leagueProgress(trophies: number) {
  trophies = Number.isFinite(trophies) ? Math.max(0, Math.floor(trophies)) : 0;
  const current = leagueAt(trophies);
  const next = LEAGUES[current.index + 1] ?? null;
  return {
    trophies,
    current,
    next,
    deckCapacity: deckCapacity(trophies),
    earned: next ? trophies - current.minTrophies : TROPHIES_PER_DIVISION,
    required: TROPHIES_PER_DIVISION,
    nextSlot:
      DECK_SLOT_UNLOCKS.find((unlock) => trophies < unlock.trophies) ?? null,
  };
}

export type LeagueProgress = ReturnType<typeof leagueProgress>;
