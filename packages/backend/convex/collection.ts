import { MAX_CARD_LEVEL, resolveCard, upgradeCost } from "@sylve/game";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlayer, rules } from "./lib/game_service";
import { ownedCard } from "./lib/progression";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requirePlayer(ctx);
    const owned = await ctx.db
      .query("collection")
      .withIndex("by_owner_variant", (q) => q.eq("ownerId", userId))
      .collect();
    return owned.map((entry) => ({
      card: resolveCard(entry.variantId, entry.level),
      copies: entry.copies,
    }));
  },
});

export const upgrade = mutation({
  args: { variantId: v.string() },
  handler: async (ctx, { variantId }) => {
    const { userId } = await requirePlayer(ctx);
    const entry = await ownedCard(ctx, userId, variantId);
    if (!entry)
      throw new ConvexError("Cette carte n’est pas encore débloquée.");
    if (entry.level >= MAX_CARD_LEVEL)
      throw new ConvexError("Cette carte a atteint le niveau maximal.");
    const cost = upgradeCost(entry.level);
    if (entry.copies < cost)
      throw new ConvexError(
        "Tu n’as pas assez d’exemplaires pour cette amélioration.",
      );
    const card = rules(() => resolveCard(variantId, entry.level + 1));
    await ctx.db.patch(entry._id, {
      level: entry.level + 1,
      copies: entry.copies - cost,
    });
    return { card, copies: entry.copies - cost };
  },
});
