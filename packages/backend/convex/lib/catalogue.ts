import {
  catalogueMigration,
  canonicalVariantId,
  DEFAULT_DECK,
  MIN_DECK_SIZE,
} from "@sylve/game";
import type { MutationCtx } from "../_generated/server";

/** Atomic and idempotent: preserve reserves, refund removed levels, update every deck. */
export async function migratePlayerCatalogue(
  ctx: MutationCtx,
  ownerId: string,
  ensureWallet = false,
) {
  const wallet = await ctx.db
    .query("wallets")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .unique();
  if (wallet?.catalogueVersion === 2) return wallet;
  const entries = await ctx.db
    .query("collection")
    .withIndex("by_owner_variant", (q) => q.eq("ownerId", ownerId))
    .collect();
  const migration = catalogueMigration(entries);
  for (const {
    keeper,
    merged,
    variantId,
    level,
    copies,
    soulbinds,
  } of migration.cards) {
    await ctx.db.patch(keeper._id, {
      variantId,
      level,
      copies,
      ...(soulbinds ? { soulbinds } : {}),
    });
    for (const entry of merged) await ctx.db.delete(entry._id);
  }
  const owned = new Set(migration.cards.map((c) => c.variantId));
  const decks = await ctx.db
    .query("decks")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
  for (const deck of decks) {
    const cardIds = [...new Set(deck.cardIds.map(canonicalVariantId))].filter(
      (id) => owned.has(id),
    );
    for (const id of [...owned, ...DEFAULT_DECK]) {
      if (cardIds.length >= MIN_DECK_SIZE) break;
      if (cardIds.includes(id)) continue;
      if (!owned.has(id)) {
        await ctx.db.insert("collection", {
          ownerId,
          variantId: id,
          level: 1,
          copies: 0,
        });
        owned.add(id);
      }
      cardIds.push(id);
    }
    if (cardIds.join("|") !== deck.cardIds.join("|"))
      await ctx.db.patch(deck._id, {
        cardIds,
        updatedAt: Math.max(Date.now(), deck.updatedAt + 1),
      });
  }
  // Pending rewards and reveal dialogs store variant/level snapshots too. They
  // must remain readable after the catalogue cap changes; active matches retain
  // their complete, independent definitions and are intentionally untouched.
  const loot = <T extends { variantId: string; level?: number }>(items: T[]) =>
    items.map((item) => ({
      ...item,
      variantId: canonicalVariantId(item.variantId),
      ...(item.level === undefined ? {} : { level: Math.min(26, item.level) }),
    }));
  const chests = await ctx.db
    .query("chests")
    .withIndex("by_owner_status", (q) => q.eq("ownerId", ownerId))
    .collect();
  for (const chest of chests)
    await ctx.db.patch(chest._id, {
      contents: loot(chest.contents),
      ...(chest.reveals ? { reveals: loot(chest.reveals) } : {}),
    });
  const summons = await ctx.db
    .query("summons")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
  for (const summon of summons)
    await ctx.db.patch(summon._id, { reveals: loot(summon.reveals) });
  const victories = await ctx.db
    .query("victoryChests")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
  for (const chest of victories)
    await ctx.db.patch(chest._id, {
      contents: loot(chest.contents),
      ...(chest.lastClaim
        ? {
            lastClaim: {
              ...chest.lastClaim,
              reveals: loot(chest.lastClaim.reveals),
            },
          }
        : {}),
    });
  const patch = {
    catalogueVersion: 2 as const,
    experience: wallet?.experience ?? migration.experience,
    soulDust: wallet?.soulDust ?? 0,
    gold: (wallet?.gold ?? 0) + migration.goldRefund,
  };
  if (wallet) {
    await ctx.db.patch(wallet._id, patch);
    return { ...wallet, ...patch };
  }
  // An untouched starter has never needed a wallet. Keep that lazy creation
  // behavior; currency actions explicitly request one, or training initializes it.
  if (!ensureWallet && patch.experience === 0 && patch.gold === 0)
    return undefined;
  const id = await ctx.db.insert("wallets", { ownerId, ...patch });
  return { _id: id, ownerId, ...patch };
}
