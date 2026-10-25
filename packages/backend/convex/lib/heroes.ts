import {
  catalogueMigration,
  canonicalVariantId,
  heroProgress,
  resolveCard,
  type CardDefinition,
} from "@sylve/game";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { playerLeague } from "./progression";

export function heroRecord(ctx: QueryCtx | MutationCtx, ownerId: string) {
  return ctx.db
    .query("heroes")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .unique();
}
export async function heroDeckCards(
  ctx: QueryCtx | MutationCtx,
  ownerId: string,
) {
  const [decks, collection, league] = await Promise.all([
    ctx.db
      .query("decks")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect(),
    ctx.db
      .query("collection")
      .withIndex("by_owner_variant", (q) => q.eq("ownerId", ownerId))
      .collect(),
    playerLeague(ctx, ownerId),
  ]);
  const deck = decks.sort(
    (a, b) => b.updatedAt - a.updatedAt || b._creationTime - a._creationTime,
  )[0];
  const owned = new Map(
    catalogueMigration(collection).cards.map((c) => [c.variantId, c]),
  );
  return (deck?.cardIds ?? []).slice(0, league.deckCapacity).flatMap((id) => {
    const entry = owned.get(canonicalVariantId(id));
    return entry
      ? [resolveCard(entry.variantId, entry.level, entry.soulbinds)]
      : [];
  });
}
export async function readHeroProgress(
  ctx: QueryCtx | MutationCtx,
  ownerId: string,
  cards?: CardDefinition[],
) {
  const [record, deck] = await Promise.all([
    heroRecord(ctx, ownerId),
    cards ?? heroDeckCards(ctx, ownerId),
  ]);
  return heroProgress(deck, record ?? undefined);
}
/** Record actual equipped decks at every change, including before replacing one. */
export async function observeHero(
  ctx: MutationCtx,
  ownerId: string,
  cards?: CardDefinition[],
) {
  const record = await heroRecord(ctx, ownerId);
  const progress = heroProgress(
    cards ?? (await heroDeckCards(ctx, ownerId)),
    record ?? undefined,
  );
  if (!record)
    await ctx.db.insert("heroes", {
      ownerId,
      level: progress.level,
      peakMight: progress.peakMight,
    });
  else if (progress.peakMight > record.peakMight)
    await ctx.db.patch(record._id, { peakMight: progress.peakMight });
  return progress;
}
