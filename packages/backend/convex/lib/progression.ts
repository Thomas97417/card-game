import {
  resolveCard,
  canonicalVariantId,
  validateDeck,
  type GameState,
} from "@sylve/game";
import {
  deckCapacity,
  leagueAt,
  leagueProgress,
  TROPHIES_PER_WIN,
  TROPHIES_PER_LOSS,
  type TrophyChange,
} from "@sylve/game/leagues";
import {
  CHEST_POOL_VERSION,
  CHEST_REWARD_VERSION,
  chestRules,
  chestPool,
  unlockedChestSlots,
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
import { WELCOME_DIAMONDS } from "@sylve/game/summoning";
import { migratePlayerCatalogue } from "./catalogue";

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
  const progress = await playerProgress(ctx, ownerId);
  return leagueProgress(
    progress?.trophies ?? 0,
    progress?.peakTrophies ?? progress?.trophies ?? 0,
  );
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

/** An absent diamonds field is the legacy-wallet migration marker. Zero stays zero. */
export async function ensureEmeraldWallet(ctx: MutationCtx, ownerId: string) {
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

export async function playerChestSlots(
  ctx: QueryCtx | MutationCtx,
  ownerId: string,
) {
  const [league, purchases] = await Promise.all([
    playerLeague(ctx, ownerId),
    ctx.db
      .query("chestSlotUnlocks")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect(),
  ]);
  const purchasedSlots = purchases.map((purchase) => purchase.slot);
  return {
    purchasedSlots,
    unlockedSlots: unlockedChestSlots(league.peakTrophies, purchasedSlots),
  };
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
  variantId = canonicalVariantId(variantId);
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
      return resolveCard(id, owned.level, owned.soulbinds);
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
  await migratePlayerCatalogue(ctx, ownerId);
  const reveals: LootReveal[] = [];
  for (const { variantId: originalId, count } of contents) {
    const variantId = canonicalVariantId(originalId);
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
  if (chest)
    await ctx.db.patch(chest._id, {
      wins,
      contents,
      gold,
      leagueTrophies: trophies,
      rewardVersion: CHEST_REWARD_VERSION,
    });
  else
    await ctx.db.insert("victoryChests", {
      ownerId,
      wins,
      cycle: 0,
      contents,
      gold,
      leagueTrophies: trophies,
      rewardVersion: CHEST_REWARD_VERSION,
    });
  return wins;
}

/** Both players' trophies and the winner's chests settle atomically with the result. */
export async function awardMatchRewards(
  ctx: MutationCtx,
  game: Doc<"games">,
  state: GameState,
) {
  if (
    game.reward ||
    game.trophyChanges !== undefined ||
    state.status !== "finished" ||
    state.winner === null ||
    (game.mode !== "solo" && game.mode !== "public")
  )
    return;
  const changes: (TrophyChange & { ownerId: string })[] = [];
  for (const [index, player] of state.players.entries()) {
    if (game.mode === "solo" && player.userId !== game.hostId) continue;
    const progress = await playerProgress(ctx, player.userId);
    const previousTrophies = progress?.trophies ?? 0;
    const previousPeak = Math.max(
      progress?.peakTrophies ?? previousTrophies,
      previousTrophies,
    );
    const trophiesTotal = Math.max(
      0,
      previousTrophies +
        (index === state.winner ? TROPHIES_PER_WIN : -TROPHIES_PER_LOSS),
    );
    const peakTrophies = Math.max(previousPeak, trophiesTotal);
    const fields = { trophies: trophiesTotal, peakTrophies };
    if (progress) await ctx.db.patch(progress._id, fields);
    else
      await ctx.db.insert("leagueProgress", {
        ownerId: player.userId,
        ...fields,
      });
    changes.push({
      ownerId: player.userId,
      trophies: trophiesTotal - previousTrophies,
      trophiesTotal,
      previousTrophies,
      previousPeakTrophies: previousPeak,
      deckCapacity: deckCapacity(peakTrophies),
      deckSlotsGained: deckCapacity(peakTrophies) - deckCapacity(previousPeak),
    });
  }
  await ctx.db.patch(game._id, { trophyChanges: changes });
  const ownerId = state.players[state.winner]!.userId;
  const trophyReward = changes.find((change) => change.ownerId === ownerId);
  // A computer victory only debits the human; the computer has no progression record.
  if (!trophyReward) return;
  const { trophiesTotal } = trophyReward;
  const winnerTrophies = {
    trophies: trophyReward.trophies,
    trophiesTotal,
    previousTrophies: trophyReward.previousTrophies,
  };
  const victoryWins = await advanceVictoryChest(ctx, ownerId, trophiesTotal);
  const unopened = await ctx.db
    .query("chests")
    .withIndex("by_owner_status", (q) =>
      q.eq("ownerId", ownerId).eq("status", "unopened"),
    )
    .collect();
  const { unlockedSlots } = await playerChestSlots(ctx, ownerId);
  if (unopened.length >= unlockedSlots.length) {
    await ctx.db.patch(game._id, {
      reward: { ownerId, status: "lost", victoryWins, ...winnerTrophies },
    });
    return;
  }
  const leagueIndex = leagueAt(trophiesTotal).index;
  const savedPool = await ctx.db
    .query("chestPools")
    .withIndex("by_owner_league", (q) =>
      q.eq("ownerId", ownerId).eq("leagueIndex", leagueIndex),
    )
    .unique();
  const remaining =
    savedPool?.version === CHEST_POOL_VERSION &&
    Object.values(savedPool.remaining).some((count) => count > 0)
      ? { ...savedPool.remaining }
      : chestPool(trophiesTotal);
  const rarity = rollChest(Math.random, trophiesTotal, remaining);
  remaining[rarity]--;
  const poolFields = { remaining, version: CHEST_POOL_VERSION } as const;
  if (savedPool) await ctx.db.patch(savedPool._id, poolFields);
  else await ctx.db.insert("chestPools", { ownerId, leagueIndex, ...poolFields });
  const rule = chestRules(rarity, trophiesTotal);
  const now = Date.now();
  const slot = unlockedSlots.find(
    (i) => !unopened.some((chest) => chest.slot === i),
  )!;
  const chestId: Id<"chests"> = await ctx.db.insert("chests", {
    ownerId,
    gameId: game._id,
    slot,
    rarity,
    status: "unopened",
    awardedAt: now,
    unlockAt: now + rule.durationMs,
    instantCost: rule.instantCost,
    leagueTrophies: trophiesTotal,
    rewardVersion: CHEST_REWARD_VERSION,
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
      ...winnerTrophies,
    },
  });
}
