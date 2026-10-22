import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlayer } from "./lib/game_service";
import { grantLoot, victoryChest } from "./lib/progression";
import { VICTORY_CHEST_WINS } from "@sylve/game/progression";

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
    return {
      serverNow: Date.now(),
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
          slot,
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
      return { rarity: chest.rarity, reveals: chest.reveals ?? [] };
    if (Date.now() < chest.unlockAt)
      throw new ConvexError("Ce coffre n’est pas encore prêt.");
    const reveals = await grantLoot(ctx, userId, chest.contents);
    await ctx.db.patch(chestId, {
      status: "opened",
      openedAt: Date.now(),
      reveals,
    });
    return { rarity: chest.rarity, reveals };
  },
});

export const openVictory = mutation({
  args: { cycle: v.number() },
  handler: async (ctx, { cycle }) => {
    const { userId } = await requirePlayer(ctx);
    const chest = await victoryChest(ctx, userId);
    if (chest?.lastClaim?.cycle === cycle)
      return { rarity: "common" as const, reveals: chest.lastClaim.reveals };
    if (!chest || chest.cycle !== cycle || chest.wins < VICTORY_CHEST_WINS)
      throw new ConvexError(
        "Remporte trois victoires pour ouvrir ce coffre commun.",
      );
    const reveals = await grantLoot(ctx, userId, chest.contents);
    await ctx.db.patch(chest._id, {
      wins: 0,
      cycle: cycle + 1,
      contents: [],
      lastClaim: { cycle, reveals },
    });
    return { rarity: "common" as const, reveals };
  },
});
