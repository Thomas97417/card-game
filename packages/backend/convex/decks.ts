import { DEFAULT_DECK, DECK_SIZE, validateDeck } from "@sylve/game";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { currentDeck, requirePlayer, rules } from "./lib/game_service";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requirePlayer(ctx);
    const deck = await currentDeck(ctx, user.userId);
    return deck ? [deck] : [];
  },
});
export const ensureStarter = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requirePlayer(ctx);
    const existing = await currentDeck(ctx, user.userId);
    // Preserve the player's ordering when adapting decks saved under the old rules.
    if (existing) {
      if (existing.cardIds.length === 10)
        await ctx.db.patch(existing._id, {
          cardIds: existing.cardIds.slice(0, DECK_SIZE),
          updatedAt: Math.max(Date.now(), existing.updatedAt),
        });
      return existing._id;
    }
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
    if (!args.deckId)
      throw new ConvexError(
        "Tu disposes d’un seul deck. Modifie ton deck existant.",
      );
    const deck = await currentDeck(ctx, user.userId);
    if (!deck || deck._id !== args.deckId)
      throw new ConvexError("Ce deck ne t’appartient pas.");
    const name = args.name.trim();
    if (!name || name.length > 60)
      throw new ConvexError("Donne un nom de 1 à 60 caractères à ton deck.");
    rules(() => validateDeck(args.cardIds));
    await ctx.db.patch(deck._id, {
      name,
      cardIds: args.cardIds,
      updatedAt: Math.max(Date.now(), deck.updatedAt + 1),
    });
    return deck._id;
  },
});
export const remove = mutation({
  args: { deckId: v.id("decks") },
  handler: async (ctx, args) => {
    const user = await requirePlayer(ctx);
    const deck = await ctx.db.get(args.deckId);
    if (!deck || deck.ownerId !== user.userId)
      throw new ConvexError("Ce deck ne t’appartient pas.");
    throw new ConvexError("Ton deck unique ne peut pas être supprimé.");
  },
});
