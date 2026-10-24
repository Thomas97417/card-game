import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
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
} from "@sylve/game/progression";

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
      chests: chests
        .sort(
          (a, b) =>
            a.awardedAt - b.awardedAt || a._creationTime - b._creationTime,
        )
        .map(({ _id, rarity, unlockAt }, slot) => ({
          _id,
          slot:
            unlockedSlots[slot] ??
            TOTAL_CHEST_SLOTS + slot - unlockedSlots.length,
          rarity,
          unlockAt,
        })),
    };
  },
});

export const open = mutation({
  args: { chestId: v.id("chests") },
  handler: async (ctx, { chestId }) => {
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
    if (Date.now() < chest.unlockAt)
      throw new ConvexError("Ce coffre n’est pas encore prêt.");
    // Unopened legacy chests adopt the new rewards on their first opening.
    const contents =
      chest.gold === undefined
        ? chestLoot(chest.rarity, Math.random)
        : chest.contents;
    const gold = chest.gold ?? chestGold(chest.rarity, Math.random);
    const reveals = await grantLoot(ctx, userId, contents);
    await grantGold(ctx, userId, gold);
    await ctx.db.patch(chestId, {
      status: "opened",
      openedAt: Date.now(),
      reveals,
      contents,
      gold,
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
      chest.gold === undefined
        ? chestLoot("common", Math.random)
        : chest.contents;
    const gold = chest.gold ?? chestGold("common", Math.random);
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
