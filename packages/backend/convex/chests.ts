import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlayer } from "./lib/game_service";
import { ownedCard } from "./lib/progression";
import type { LootReveal } from "@sylve/game/progression";

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
    return {
      serverNow: Date.now(),
      chests: chests.map(({ _id, slot, rarity, unlockAt }) => ({
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
    const reveals: LootReveal[] = [];
    for (const { variantId, count } of chest.contents) {
      const owned = await ownedCard(ctx, userId, variantId);
      const copies = (owned?.copies ?? -1) + count;
      if (owned) await ctx.db.patch(owned._id, { copies });
      else
        await ctx.db.insert("collection", {
          ownerId: userId,
          variantId,
          level: 1,
          copies,
        });
      reveals.push({
        variantId,
        count,
        isNew: !owned,
        level: owned?.level ?? 1,
        copies,
      });
    }
    await ctx.db.patch(chestId, {
      status: "opened",
      openedAt: Date.now(),
      reveals,
    });
    return { rarity: chest.rarity, reveals };
  },
});
