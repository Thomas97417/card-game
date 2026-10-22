import { DEFAULT_DECK, validateDeck } from "@sylve/game";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlayer, rules } from "./lib/game_service";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requirePlayer(ctx);
    return await ctx.db
      .query("decks")
      .withIndex("by_owner", (q) => q.eq("ownerId", user.userId))
      .collect();
  },
});
export const ensureStarter = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requirePlayer(ctx);
    const existing = await ctx.db
      .query("decks")
      .withIndex("by_owner", (q) => q.eq("ownerId", user.userId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("decks", {
      ownerId: user.userId,
      name: "Les gardiens de la Sylve",
      cardIds: [...DEFAULT_DECK],
      updatedAt: Date.now(),
    });
  },
});
export const save = mutation({
  args: {
    deckId: v.optional(v.id("decks")),
    name: v.string(),
    cardIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePlayer(ctx);
    const name = args.name.trim();
    if (!name || name.length > 60)
      throw new ConvexError("Donne un nom de 1 à 60 caractères à ton deck.");
    rules(() => validateDeck(args.cardIds));
    if (args.deckId) {
      const deck = await ctx.db.get(args.deckId);
      if (!deck || deck.ownerId !== user.userId)
        throw new ConvexError("Ce deck ne t’appartient pas.");
      await ctx.db.patch(deck._id, {
        name,
        cardIds: args.cardIds,
        updatedAt: Date.now(),
      });
      return deck._id;
    }
    const decks = await ctx.db
      .query("decks")
      .withIndex("by_owner", (q) => q.eq("ownerId", user.userId))
      .take(20);
    if (decks.length >= 20)
      throw new ConvexError("Tu peux conserver jusqu’à 20 decks.");
    return await ctx.db.insert("decks", {
      ownerId: user.userId,
      name,
      cardIds: args.cardIds,
      updatedAt: Date.now(),
    });
  },
});
export const remove = mutation({
  args: { deckId: v.id("decks") },
  handler: async (ctx, args) => {
    const user = await requirePlayer(ctx);
    const deck = await ctx.db.get(args.deckId);
    if (!deck || deck.ownerId !== user.userId)
      throw new ConvexError("Ce deck ne t’appartient pas.");
    await ctx.db.delete(deck._id);
  },
});
