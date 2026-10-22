import { resolveCard, validateDeck, type GameState } from "@sylve/game";
import {
  CHEST_RULES,
  CHEST_SLOTS,
  chestLoot,
  rollChest,
} from "@sylve/game/progression";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function ownedCard(
  ctx: QueryCtx | MutationCtx,
  ownerId: string,
  variantId: string,
) {
  return ctx.db
    .query("collection")
    .withIndex("by_owner_variant", (q) =>
      q.eq("ownerId", ownerId).eq("variantId", variantId),
    )
    .unique();
}

export async function ownedDeck(
  ctx: QueryCtx | MutationCtx,
  ownerId: string,
  ids: string[],
) {
  validateDeck(ids);
  return Promise.all(
    ids.map(async (id) => {
      const owned = await ownedCard(ctx, ownerId, id);
      if (!owned)
        throw new ConvexError(
          "Cette carte n’est pas encore débloquée dans ta collection.",
        );
      return resolveCard(id, owned.level);
    }),
  );
}

/** Called in the same transaction as the victory: capacity and attribution cannot race. */
export async function awardVictoryChest(
  ctx: MutationCtx,
  game: Doc<"games">,
  state: GameState,
) {
  if (
    game.reward ||
    state.winner === null ||
    (game.mode !== "solo" && game.mode !== "public")
  )
    return;
  const ownerId = state.players[state.winner]!.userId;
  if (game.mode === "solo" && ownerId !== game.hostId) return;
  const unopened = await ctx.db
    .query("chests")
    .withIndex("by_owner_status", (q) =>
      q.eq("ownerId", ownerId).eq("status", "unopened"),
    )
    .collect();
  if (unopened.length >= CHEST_SLOTS) {
    await ctx.db.patch(game._id, { reward: { ownerId, status: "lost" } });
    return;
  }
  const rarity = rollChest(Math.random);
  const now = Date.now();
  const slot = Array.from({ length: CHEST_SLOTS }, (_, i) => i).find(
    (i) => !unopened.some((chest) => chest.slot === i),
  )!;
  const chestId: Id<"chests"> = await ctx.db.insert("chests", {
    ownerId,
    gameId: game._id,
    slot,
    rarity,
    status: "unopened",
    awardedAt: now,
    unlockAt: now + CHEST_RULES[rarity].durationMs,
    contents: chestLoot(rarity, Math.random),
  });
  await ctx.db.patch(game._id, {
    reward: { ownerId, status: "awarded", chestId, rarity },
  });
}
