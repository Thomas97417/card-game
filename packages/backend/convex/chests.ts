import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requirePlayer } from "./lib/game_service";
import {
  grantGold,
  grantLoot,
  victoryChest,
  playerChestSlots,
} from "./lib/progression";
import {
  TOTAL_CHEST_SLOTS,
  VICTORY_CHEST_WINS,
  chestGold,
  chestLoot,
  chestRules,
  chestRushCost,
} from "@sylve/game/progression";
import { ensureEmeralds } from "./lib/wallet";

async function earnedTrophies(ctx: QueryCtx, chest: Doc<"chests">) {
  if (chest.leagueTrophies !== undefined) return chest.leagueTrophies;
  const game = await ctx.db.get(chest.gameId);
  return (
    game?.reward?.trophiesTotal ??
    game?.trophyChanges?.find((change) => change.ownerId === chest.ownerId)
      ?.trophiesTotal ??
    0
  );
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requirePlayer(ctx);
    const chests = await ctx.db
      .query("chests")
      .withIndex("by_owner_status", (q) =>
        q.eq("ownerId", userId).eq("status", "unopened"),
      )
      .collect();
    const recurring = await victoryChest(ctx, userId);
    const { unlockedSlots, purchasedSlots } = await playerChestSlots(
      ctx,
      userId,
    );
    return {
      serverNow: Date.now(),
      purchasedSlots,
      victoryChest: {
        wins: recurring?.wins ?? 0,
        cycle: recurring?.cycle ?? 0,
        requiredWins: VICTORY_CHEST_WINS,
      },
      // Compact legacy inventories too: no existing chest disappears behind a locked slot.
      chests: await Promise.all(
        chests
          .sort(
            (a, b) =>
              a.awardedAt - b.awardedAt || a._creationTime - b._creationTime,
          )
          .map(async (chest, slot) => {
            const leagueTrophies = await earnedTrophies(ctx, chest);
            return {
              _id: chest._id,
              slot:
                unlockedSlots[slot] ??
                TOTAL_CHEST_SLOTS + slot - unlockedSlots.length,
              rarity: chest.rarity,
              unlockAt: chest.unlockAt,
              awardedAt: chest.awardedAt,
              leagueTrophies,
              instantCost:
                chest.instantCost ??
                chestRules(chest.rarity, leagueTrophies).instantCost,
            };
          }),
      ),
    };
  },
});

export const open = mutation({
  args: { chestId: v.id("chests"), maxEmeralds: v.optional(v.number()) },
  handler: async (ctx, { chestId, maxEmeralds }) => {
    const { userId } = await requirePlayer(ctx);
    const chest = await ctx.db.get(chestId);
    if (!chest || chest.ownerId !== userId)
      throw new ConvexError("Ce coffre ne t’appartient pas.");
    if (chest.status === "opened")
      return {
        rarity: chest.rarity,
        reveals: chest.reveals ?? [],
        gold: chest.gold ?? 0,
      };
    const now = Date.now();
    const leagueTrophies = await earnedTrophies(ctx, chest);
    const cost = chestRushCost({ ...chest, leagueTrophies }, now);
    if (
      maxEmeralds !== undefined &&
      (!Number.isSafeInteger(maxEmeralds) || maxEmeralds < 0)
    )
      throw new ConvexError("Le prix d’ouverture est invalide.");
    if (cost > 0) {
      if (maxEmeralds === undefined)
        throw new ConvexError("Ce coffre n’est pas encore prêt.");
      if (cost > maxEmeralds)
        throw new ConvexError(
          "Le prix d’ouverture a changé. Consulte le coffre à nouveau.",
        );
      const wallet = await ensureEmeralds(ctx, userId);
      if (wallet.diamonds < cost)
        throw new ConvexError(
          "Tu n’as pas assez d’émeraudes pour ouvrir ce coffre.",
        );
      await ctx.db.patch(wallet._id, { diamonds: wallet.diamonds - cost });
    }
    // Migrate unopened rewards once, using the league recorded at acquisition.
    const contents =
      chest.rewardVersion !== 2
        ? chestLoot(chest.rarity, Math.random, leagueTrophies)
        : chest.contents;
    const gold =
      chest.rewardVersion === 2 && chest.gold !== undefined
        ? chest.gold
        : chestGold(chest.rarity, Math.random, leagueTrophies);
    const reveals = await grantLoot(ctx, userId, contents);
    await grantGold(ctx, userId, gold);
    await ctx.db.patch(chestId, {
      status: "opened",
      openedAt: now,
      reveals,
      contents,
      gold,
      rewardVersion: 2,
      leagueTrophies,
      emeraldsSpent: cost,
    });
    return { rarity: chest.rarity, reveals, gold };
  },
});

export const openVictory = mutation({
  args: { cycle: v.number() },
  handler: async (ctx, { cycle }) => {
    const { userId } = await requirePlayer(ctx);
    const chest = await victoryChest(ctx, userId);
    if (chest?.lastClaim?.cycle === cycle)
      return {
        rarity: "common" as const,
        reveals: chest.lastClaim.reveals,
        gold: chest.lastClaim.gold ?? 0,
      };
    if (!chest || chest.cycle !== cycle || chest.wins < VICTORY_CHEST_WINS)
      throw new ConvexError(
        "Remporte trois victoires pour ouvrir ce coffre commun.",
      );
    const contents =
      chest.rewardVersion !== 2
        ? chestLoot("common", Math.random, chest.leagueTrophies)
        : chest.contents;
    const gold =
      chest.rewardVersion === 2 && chest.gold !== undefined
        ? chest.gold
        : chestGold("common", Math.random, chest.leagueTrophies);
    const reveals = await grantLoot(ctx, userId, contents);
    await grantGold(ctx, userId, gold);
    await ctx.db.patch(chest._id, {
      wins: 0,
      cycle: cycle + 1,
      contents: [],
      gold: 0,
      lastClaim: { cycle, reveals, gold },
    });
    return { rarity: "common" as const, reveals, gold };
  },
});
