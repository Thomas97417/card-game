import { ConvexError, v } from "convex/values";
import { CHEST_SLOT_KEYS } from "@sylve/game/progression";
import {
  SUMMON_PACKS,
  summonGoldRewards,
  summonLoot,
  summonOffer,
} from "@sylve/game/summoning";
import { mutation, query } from "./_generated/server";
import { requirePlayer } from "./lib/game_service";
import { ensureStarterDeck } from "./decks";
import { grantLoot, playerLeague } from "./lib/progression";
import { ensureEmeralds } from "./lib/wallet";
import { summonCountValidator, summonPackValidator } from "./lib/validators";

export const ensureWallet = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requirePlayer(ctx);
    const wallet = await ensureEmeralds(ctx, userId);
    return wallet.diamonds!;
  },
});

export const unlockChestSlot = mutation({
  args: { slot: v.number() },
  handler: async (ctx, { slot }) => {
    const { userId } = await requirePlayer(ctx);
    const key = CHEST_SLOT_KEYS.find((key) => key.slot === slot);
    if (!key)
      throw new ConvexError("Cet emplacement ne s’achète pas avec une clé.");
    const previous = await ctx.db
      .query("chestSlotUnlocks")
      .withIndex("by_owner_slot", (q) =>
        q.eq("ownerId", userId).eq("slot", slot),
      )
      .unique();
    // A slot can be bought once: retries and concurrent clicks cannot debit twice.
    if (previous) return { slot, cost: previous.cost };
    const wallet = await ensureEmeralds(ctx, userId);
    if (wallet.diamonds! < key.price)
      throw new ConvexError("Tu n’as pas assez d’émeraudes pour cette clé.");
    await ctx.db.patch(wallet._id, { diamonds: wallet.diamonds! - key.price });
    await ctx.db.insert("chestSlotUnlocks", {
      ownerId: userId,
      slot,
      cost: key.price,
    });
    return { slot, cost: key.price };
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
    return {
      requestId,
      packId,
      count,
      cost,
      reveals,
      gold: result.gold ?? 0,
      ...(result.goldBySummon ? { goldBySummon: result.goldBySummon } : {}),
    };
  },
});

export const offers = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requirePlayer(ctx);
    return Promise.all(
      SUMMON_PACKS.flatMap((pack) =>
        ([1, 10] as const).map(async (count) => {
          const previous = await ctx.db
            .query("summons")
            .withIndex("by_owner_pack_count", (q) =>
              q.eq("ownerId", userId).eq("packId", pack.id).eq("count", count),
            )
            .first();
          return summonOffer(pack.id, count, !!previous);
        }),
      ),
    );
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
        gold: previous.gold ?? 0,
        ...(previous.goldBySummon
          ? { goldBySummon: previous.goldBySummon }
          : {}),
      };
    }
    const lastPurchase = await ctx.db
      .query("summons")
      .withIndex("by_owner_pack_count", (q) =>
        q.eq("ownerId", userId).eq("packId", packId).eq("count", count),
      )
      .first();
    // The server determines the discount. Replays above keep their original price.
    const { cost } = summonOffer(packId, count, !!lastPurchase);
    const wallet = await ensureEmeralds(ctx, userId);
    if (wallet.diamonds! < cost)
      throw new ConvexError(
        "Tu n’as pas assez d’émeraudes pour cette invocation.",
      );
    await ensureStarterDeck(ctx, userId);
    const league = await playerLeague(ctx, userId);
    const reveals = await grantLoot(
      ctx,
      userId,
      summonLoot(packId, count, Math.random, league.peakTrophies),
    );
    const goldBySummon = summonGoldRewards(
      packId,
      count,
      Math.random,
      league.peakTrophies,
    );
    const gold = goldBySummon.reduce((sum, amount) => sum + amount, 0);
    await ctx.db.patch(wallet._id, {
      diamonds: wallet.diamonds! - cost,
      gold: wallet.gold + gold,
    });
    const result = {
      requestId,
      packId,
      count,
      cost,
      reveals,
      gold,
      goldBySummon,
    };
    await ctx.db.insert("summons", { ownerId: userId, ...result });
    return result;
  },
});
