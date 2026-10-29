import type { CardRarity } from "./cards";
import { leagueAt } from "./leagues";

export type RequestableRarity = "common" | "rare";

// Cunt Wars Wiki, Request (revision 24171), CC BY-SA 4.0:
// https://cwars.miraheze.org/wiki/Request?oldid=24171
// Rows map CW leagues 30 → 1, GM to Sylve league indices 0 → 30.
// [common request, common donation, rare request, rare donation], without VIP.
const LIMITS = [
  [5, 12, 2, 2],
  [8, 12, 3, 2],
  [10, 13, 4, 2],
  [13, 13, 5, 2],
  [15, 14, 6, 3],
  [17, 14, 7, 3],
  [20, 15, 8, 3],
  [23, 15, 9, 3],
  [26, 16, 10, 3],
  [29, 16, 11, 4],
  [32, 17, 12, 4],
  [35, 17, 13, 4],
  [38, 18, 14, 4],
  [42, 18, 15, 4],
  [45, 19, 16, 4],
  [50, 19, 17, 5],
  [55, 20, 18, 5],
  [60, 20, 19, 5],
  [65, 21, 20, 5],
  [70, 22, 21, 5],
  [77, 22, 22, 5],
  [85, 23, 23, 6],
  [92, 24, 24, 6],
  [100, 24, 25, 6],
  [105, 25, 26, 6],
  [110, 26, 27, 6],
  [120, 27, 28, 7],
  [130, 28, 29, 7],
  [140, 29, 30, 7],
  [150, 30, 31, 7],
  [150, 30, 31, 7],
] as const;

export function isRequestableRarity(
  rarity: CardRarity | undefined,
): rarity is RequestableRarity {
  return rarity === "common" || rarity === "rare";
}

/** Each player's best league sets their own request and per-friend donation caps. */
export function cardRequestLimits(peakTrophies: number) {
  const [commonRequest, commonDonation, rareRequest, rareDonation] =
    LIMITS[leagueAt(peakTrophies).index]!;
  return {
    common: { request: commonRequest, donate: commonDonation, experience: 1 },
    rare: { request: rareRequest, donate: rareDonation, experience: 3 },
  };
}
