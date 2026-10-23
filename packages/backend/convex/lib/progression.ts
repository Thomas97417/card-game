import { resolveCard, validateDeck, type GameState } from "@sylve/game";
import { leagueProgress, TROPHIES_PER_WIN } from "@sylve/game/leagues";
import {
  CHEST_RULES,
  CHEST_SLOTS,
  VICTORY_CHEST_WINS,
  chestLoot,
  chestGold,
  rollChest,
  type LootStack,
  type LootReveal,
} from "@sylve/game/progression";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function playerProgress(
  ctx: QueryCtx | MutationCtx,
  ownerId: string,
) {
  return ctx.db
    .query("leagueProgress")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .unique();
}

export async function playerLeague(
  ctx: QueryCtx | MutationCtx,
  ownerId: string,
) {
  return leagueProgress((await playerProgress(ctx, ownerId))?.trophies ?? 0);
}

export async function playerWallet(
  ctx: QueryCtx | MutationCtx,
  ownerId: string,
) {
  return ctx.db
    .query("wallets")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .unique();
}

export async function grantGold(
  ctx: MutationCtx,
  ownerId: string,
  gold: number,
) {
  const wallet = await playerWallet(ctx, ownerId);
  if (wallet) await ctx.db.patch(wallet._id, { gold: wallet.gold + gold });
  else await ctx.db.insert("wallets", { ownerId, gold });
}

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
  const league = await playerLeague(ctx, ownerId);
  if (ids.length > league.deckCapacity)
    throw new ConvexError(
      `Ta ligue ${league.current.label} autorise ${league.deckCapacity} cartes dans ton deck. Monte en ligue pour débloquer les emplacements suivants.`,
    );
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

export async function victoryChest(
  ctx: QueryCtx | MutationCtx,
  ownerId: string,
) {
  return ctx.db
    .query("victoryChests")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .unique();
}

/** Both kinds of chest use exactly the same first-copy unlock and duplicate rules. */
export async function grantLoot(
  ctx: MutationCtx,
  ownerId: string,
  contents: readonly LootStack[],
): Promise<LootReveal[]> {
  const reveals: LootReveal[] = [];
  for (const { variantId, count } of contents) {
    const owned = await ownedCard(ctx, ownerId, variantId);
    const copies = (owned?.copies ?? -1) + count;
    if (owned) await ctx.db.patch(owned._id, { copies });
    else
      await ctx.db.insert("collection", {
        ownerId,
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
  return reveals;
}

async function advanceVictoryChest(
  ctx: MutationCtx,
  ownerId: string,
  trophies: number,
) {
  const chest = await victoryChest(ctx, ownerId);
  if (chest && chest.wins >= VICTORY_CHEST_WINS) return VICTORY_CHEST_WINS;
  const wins = (chest?.wins ?? 0) + 1;
  const contents =
    wins === VICTORY_CHEST_WINS
      ? chestLoot("common", Math.random, trophies)
      : [];
  const gold =
    wins === VICTORY_CHEST_WINS
      ? chestGold("common", Math.random, trophies)
      : 0;
  if (chest) await ctx.db.patch(chest._id, { wins, contents, gold });
  else
    await ctx.db.insert("victoryChests", {
      ownerId,
      wins,
      cycle: 0,
      contents,
      gold,
    });
  return wins;
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
  const progress = await playerProgress(ctx, ownerId);
  const previousTrophies = progress?.trophies ?? 0;
  const trophiesTotal = previousTrophies + TROPHIES_PER_WIN;
  if (progress) await ctx.db.patch(progress._id, { trophies: trophiesTotal });
  else
    await ctx.db.insert("leagueProgress", { ownerId, trophies: trophiesTotal });
  const trophyReward = {
    trophies: TROPHIES_PER_WIN,
    trophiesTotal,
    previousTrophies,
  };
  const victoryWins = await advanceVictoryChest(ctx, ownerId, trophiesTotal);
  const unopened = await ctx.db
    .query("chests")
    .withIndex("by_owner_status", (q) =>
      q.eq("ownerId", ownerId).eq("status", "unopened"),
    )
    .collect();
  if (unopened.length >= CHEST_SLOTS) {
    await ctx.db.patch(game._id, {
      reward: { ownerId, status: "lost", victoryWins, ...trophyReward },
    });
    return;
  }
  const rarity = rollChest(Math.random, trophiesTotal);
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
    contents: chestLoot(rarity, Math.random, trophiesTotal),
    gold: chestGold(rarity, Math.random, trophiesTotal),
  });
  await ctx.db.patch(game._id, {
    reward: {
      ownerId,
      status: "awarded",
      chestId,
      rarity,
      victoryWins,
      ...trophyReward,
    },
  });
}
