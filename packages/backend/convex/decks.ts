import { DEFAULT_DECK, validateDeck, canonicalVariantId } from "@sylve/game";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { currentDeck, requirePlayer, rules } from "./lib/game_service";
import { ownedDeck } from "./lib/progression";
import { migratePlayerCatalogue } from "./lib/catalogue";

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
    return ensureStarterDeck(ctx, user.userId);
  },
});

/** Summoning must initialize the starting collection before granting the first new card. */
export async function ensureStarterDeck(ctx: MutationCtx, ownerId: string) {
  await migratePlayerCatalogue(ctx, ownerId);
  const existing = await currentDeck(ctx, ownerId);
  const initialized = await ctx.db
    .query("collection")
    .withIndex("by_owner_variant", (q) => q.eq("ownerId", ownerId))
    .first();
  if (!initialized) {
    for (const variantId of DEFAULT_DECK)
      await ctx.db.insert("collection", {
        ownerId,
        variantId,
        level: 1,
        copies: 0,
      });
    if (existing)
      await ctx.db.patch(existing._id, {
        cardIds: [...DEFAULT_DECK],
        updatedAt: Math.max(Date.now(), existing.updatedAt + 1),
      });
  }
  if (existing) return existing._id;
  return ctx.db.insert("decks", {
    ownerId,
    name: "Les gardiens de la Sylve",
    cardIds: [...DEFAULT_DECK],
    updatedAt: Date.now(),
  });
}
export const save = mutation({
  args: {
    deckId: v.optional(v.id("decks")),
    name: v.string(),
    cardIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePlayer(ctx);
    await migratePlayerCatalogue(ctx, user.userId);
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
    const cardIds = rules(() => args.cardIds.map(canonicalVariantId));
    rules(() => validateDeck(cardIds));
    await ownedDeck(ctx, user.userId, cardIds);
    await ctx.db.patch(deck._id, {
      name,
      cardIds,
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
