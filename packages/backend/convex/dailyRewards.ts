import { ConvexError, v } from "convex/values";
import {
  DAILY_REWARDS,
  canClaimDailyReward,
  dailyRewardsBoard,
  type DailyRewardReceipt,
} from "@sylve/game/daily-rewards";
import { chestGold, chestLoot } from "@sylve/game/progression";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { ensureStarterDeck } from "./decks";
import { requirePlayer } from "./lib/game_service";
import { grantGold, grantLoot, playerLeague } from "./lib/progression";
import { ensureEmeralds } from "./lib/wallet";
import { recordMissionProgress } from "./lib/missions";

function playerRewards(ctx: QueryCtx, ownerId: string) {
  return ctx.db
    .query("dailyRewards")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .unique();
}

export const board = query({
  // A fresh subscription key prevents a returning player from receiving a
  // cached server-time snapshot from their previous visit.
  args: { refreshKey: v.number() },
  handler: async (ctx) => {
    const { userId } = await requirePlayer(ctx);
    return dailyRewardsBoard(
      (await playerRewards(ctx, userId))?.claims ?? [],
      Date.now(),
    );
  },
});

export const claim = mutation({
  // The day makes retries idempotent, even after the following gift unlocks.
  args: { day: v.number() },
  handler: async (ctx, { day }) => {
    const { userId } = await requirePlayer(ctx);
    const gift = DAILY_REWARDS[day - 1];
    if (!Number.isSafeInteger(day) || !gift)
      throw new ConvexError("Ce cadeau est introuvable.");
    const state = await playerRewards(ctx, userId);
    const claims = state?.claims ?? [];
    const previous = claims.find((item) => item.day === day);
    if (previous) return { ...previous, alreadyClaimed: true };
    const now = Date.now();
    if (day !== claims.length + 1)
      throw new ConvexError("Récupère d’abord le cadeau précédent.");
    if (!canClaimDailyReward(dailyRewardsBoard(claims, now), now))
      throw new ConvexError(
        "Le prochain cadeau sera disponible 24 heures après le précédent.",
      );

    const receipt: DailyRewardReceipt = {
      day,
      claimedAt: now,
      gold: 0,
      emeralds: 0,
      reveals: [],
    };
    if (gift.kind === "gold") {
      receipt.gold = gift.amount;
      await grantGold(ctx, userId, gift.amount);
    } else if (gift.kind === "emeralds") {
      const wallet = await ensureEmeralds(ctx, userId);
      receipt.emeralds = gift.amount;
      await ctx.db.patch(wallet._id, {
        diamonds: wallet.diamonds + gift.amount,
      });
    } else {
      await ensureStarterDeck(ctx, userId);
      const league = await playerLeague(ctx, userId);
      receipt.rarity = gift.rarity;
      receipt.reveals = await grantLoot(
        ctx,
        userId,
        chestLoot(gift.rarity, Math.random, league.peakTrophies),
      );
      receipt.gold = chestGold(gift.rarity, Math.random, league.peakTrophies);
      await grantGold(ctx, userId, receipt.gold);
      await recordMissionProgress(ctx, userId, { chestsOpened: 1 });
    }
    // Currency, cards and the next unlock are committed in one transaction.
    if (state) await ctx.db.patch(state._id, { claims: [...claims, receipt] });
    else
      await ctx.db.insert("dailyRewards", {
        ownerId: userId,
        claims: [receipt],
      });
    return { ...receipt, alreadyClaimed: false };
  },
});
