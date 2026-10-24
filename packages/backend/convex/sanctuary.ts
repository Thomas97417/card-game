import { ConvexError, v } from "convex/values";
import {
  WELCOME_DIAMONDS,
  summonLoot,
  summonPrice,
} from "@sylve/game/summoning";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requirePlayer } from "./lib/game_service";
import { ensureStarterDeck } from "./decks";
import { grantLoot, playerWallet } from "./lib/progression";
import { summonCountValidator, summonPackValidator } from "./lib/validators";

/** The optional field itself is the migration marker: a spent balance of zero stays zero. */
async function ensureDiamonds(ctx: MutationCtx, ownerId: string) {
  const wallet = await playerWallet(ctx, ownerId);
  if (wallet) {
    if (wallet.diamonds !== undefined) return wallet;
    await ctx.db.patch(wallet._id, { diamonds: WELCOME_DIAMONDS });
    return { ...wallet, diamonds: WELCOME_DIAMONDS };
  }
  const id = await ctx.db.insert("wallets", {
    ownerId,
    gold: 0,
    diamonds: WELCOME_DIAMONDS,
  });
  return (await ctx.db.get(id))!;
}

export const ensureWallet = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requirePlayer(ctx);
    const wallet = await ensureDiamonds(ctx, userId);
    return wallet.diamonds!;
  },
});

export const latest = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requirePlayer(ctx);
    const result = await ctx.db
      .query("summons")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .order("desc")
      .first();
    if (!result) return null;
    const { requestId, packId, count, cost, reveals } = result;
    return { requestId, packId, count, cost, reveals };
  },
});

export const summon = mutation({
  args: {
    packId: summonPackValidator,
    count: summonCountValidator,
    requestId: v.string(),
  },
  handler: async (ctx, { packId, count, requestId }) => {
    const { userId } = await requirePlayer(ctx);
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(requestId))
      throw new ConvexError("Identifiant d’invocation invalide.");
    const previous = await ctx.db
      .query("summons")
      .withIndex("by_owner_request", (q) =>
        q.eq("ownerId", userId).eq("requestId", requestId),
      )
      .unique();
    if (previous) {
      if (previous.packId !== packId || previous.count !== count)
        throw new ConvexError("Cette invocation correspond à un autre pack.");
      return {
        requestId,
        packId,
        count,
        cost: previous.cost,
        reveals: previous.reveals,
      };
    }
    const cost = summonPrice(packId, count);
    const wallet = await ensureDiamonds(ctx, userId);
    if (wallet.diamonds! < cost)
      throw new ConvexError(
        "Tu n’as pas assez d’émeraudes pour cette invocation.",
      );
    await ensureStarterDeck(ctx, userId);
    const reveals = await grantLoot(
      ctx,
      userId,
      summonLoot(packId, count, Math.random),
    );
    await ctx.db.patch(wallet._id, { diamonds: wallet.diamonds! - cost });
    const result = { requestId, packId, count, cost, reveals };
    await ctx.db.insert("summons", { ownerId: userId, ...result });
    return result;
  },
});
