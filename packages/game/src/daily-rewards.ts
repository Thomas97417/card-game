import type { ChestType, LootReveal } from "./progression";

export const DAILY_REWARD_DELAY_MS = 24 * 60 * 60 * 1000;

export type DailyGift =
  | { kind: "gold"; amount: number }
  | { kind: "emeralds"; amount: number }
  | { kind: "chest"; rarity: Extract<ChestType, "rare" | "bigRare" | "epic"> };

/** A seven-day journey. Missing a day never resets or skips a gift. */
export const DAILY_REWARDS: readonly DailyGift[] = [
  { kind: "gold", amount: 5_000 },
  { kind: "emeralds", amount: 25 },
  { kind: "chest", rarity: "rare" },
  { kind: "gold", amount: 15_000 },
  { kind: "emeralds", amount: 75 },
  { kind: "chest", rarity: "bigRare" },
  { kind: "chest", rarity: "epic" },
];

export interface DailyRewardReceipt {
  day: number;
  claimedAt: number;
  gold: number;
  emeralds: number;
  rarity?: ChestType;
  reveals: LootReveal[];
}

export interface DailyRewardsBoard {
  serverNow: number;
  claimedDays: number;
  nextClaimAt: number | null;
}

export function dailyRewardsBoard(
  claims: readonly Pick<DailyRewardReceipt, "claimedAt">[],
  now: number,
): DailyRewardsBoard {
  const last = claims[claims.length - 1];
  return {
    serverNow: now,
    claimedDays: claims.length,
    nextClaimAt:
      claims.length >= DAILY_REWARDS.length
        ? null
        : last
          ? last.claimedAt + DAILY_REWARD_DELAY_MS
          : now,
  };
}

export function canClaimDailyReward(board: DailyRewardsBoard, now: number) {
  return board.nextClaimAt !== null && now >= board.nextClaimAt;
}
