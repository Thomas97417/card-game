import { CHEST_TYPES, chestPoolForLeague, type ChestType } from "./chest-types";

export const TROPHIES_PER_WIN = 25;
export const TROPHIES_PER_LOSS = 15;
export const TROPHIES_PER_DIVISION = 200;

export interface TrophyChange {
  trophies: number;
  trophiesTotal: number;
  previousTrophies: number;
  /** Record before this match; absent on results saved before its introduction. */
  previousPeakTrophies?: number;
  deckCapacity: number;
  deckSlotsGained: number;
}

const TIERS = [
  { id: "iron", name: "Fer" },
  { id: "bronze", name: "Bronze" },
  { id: "silver", name: "Argent" },
  { id: "gold", name: "Or" },
  { id: "platinum", name: "Platine" },
  { id: "emerald", name: "Émeraude" },
  { id: "diamond", name: "Diamant" },
  { id: "master", name: "Maître" },
  { id: "grandmaster", name: "Grand maître" },
  { id: "challenger", name: "Challenger" },
] as const;

export interface League {
  id: string;
  index: number;
  tier: (typeof TIERS)[number]["id"];
  name: string;
  division: "IV" | "III" | "II" | "I" | null;
  label: string;
  minTrophies: number;
  chestChances: Record<ChestType, number>;
}

/** The last three prestige leagues have no numbered divisions. */
export const LEAGUES: readonly League[] = TIERS.flatMap((tier, tierIndex) => {
  const hasDivisions = tierIndex < 7;
  // Keep the existing prestige league IDs unchanged.
  const divisions = hasDivisions
    ? (["IV", "III", "II", "I"] as const)
    : (["I"] as const);
  return divisions.map((division, divisionIndex) => {
    const index =
      tierIndex < 7 ? tierIndex * 4 + divisionIndex : 28 + tierIndex - 7;
    const pool = chestPoolForLeague(index);
    const total = Object.values(pool).reduce((sum, count) => sum + count, 0);
    return {
      id: `${tier.id}-${division.toLowerCase()}`,
      index,
      tier: tier.id,
      name: tier.name,
      division: hasDivisions ? division : null,
      label: hasDivisions ? `${tier.name} ${division}` : tier.name,
      minTrophies: index * TROPHIES_PER_DIVISION,
      chestChances: Object.fromEntries(
        CHEST_TYPES.map((type) => [type, (pool[type] / total) * 100]),
      ) as Record<ChestType, number>,
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

export function leagueProgress(trophies: number, peakTrophies = trophies) {
  trophies = Number.isFinite(trophies) ? Math.max(0, Math.floor(trophies)) : 0;
  peakTrophies = Number.isFinite(peakTrophies)
    ? Math.max(trophies, Math.floor(peakTrophies))
    : trophies;
  const current = leagueAt(trophies);
  const next = LEAGUES[current.index + 1] ?? null;
  return {
    trophies,
    peakTrophies,
    current,
    next,
    deckCapacity: deckCapacity(peakTrophies),
    earned: next ? trophies - current.minTrophies : TROPHIES_PER_DIVISION,
    required: TROPHIES_PER_DIVISION,
    nextSlot:
      DECK_SLOT_UNLOCKS.find((unlock) => peakTrophies < unlock.trophies) ??
      null,
  };
}

export type LeagueProgress = ReturnType<typeof leagueProgress>;
