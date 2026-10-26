import {
  maxCardLevel,
  resolveCard,
  upgradeCost,
  upgradeGoldCost,
  upgradeExperience,
  catalogueMigration,
  canonicalVariantId,
  rankProgress,
  requireSoulbind,
  dustConversion,
  evolutionOptions,
  SOULBIND_LEAGUE_INDEX,
  EVOLUTION_LEAGUE_INDEX,
} from "@sylve/game";
import { leagueAt } from "@sylve/game/leagues";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { currentDeck, requirePlayer, rules } from "./lib/game_service";
import {
  ownedCard,
  playerWallet,
  playerLeague,
} from "./lib/progression";
import { migratePlayerCatalogue } from "./lib/catalogue";
import { recordMissionProgress } from "./lib/missions";
import { authComponent } from "./auth";
import {
  heroDeckCards,
  heroRecord,
  observeHero,
  readHeroProgress,
} from "./lib/heroes";

export const hero = query({
  args: {},
  handler: async (ctx) =>
    readHeroProgress(ctx, (await requirePlayer(ctx)).userId),
});
export const upgradeHero = mutation({
  args: { expectedLevel: v.number() },
  handler: async (ctx, { expectedLevel }) => {
    const { userId } = await requirePlayer(ctx);
    await migratePlayerCatalogue(ctx, userId);
    const cards = await heroDeckCards(ctx, userId);
    const progress = await observeHero(ctx, userId, cards);
    if (progress.level !== expectedLevel)
      throw new ConvexError("Le niveau du héros a changé.");
    if (!progress.canUpgrade)
      throw new ConvexError(
        "La puissance du deck est insuffisante pour ce niveau.",
      );
    const record = (await heroRecord(ctx, userId))!;
    await ctx.db.patch(record._id, { level: record.level + 1 });
    return observeHero(ctx, userId, cards);
  },
});

export const league = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requirePlayer(ctx);
    return playerLeague(ctx, userId);
  },
});

/** Only public game information leaves these queries; auth records stay private. */
export const leaderboard = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requirePlayer(ctx);
    const leaders = await ctx.db
      .query("leagueProgress")
      .withIndex("by_trophies")
      .order("desc")
      .take(50);
    const players = await Promise.all(
      leaders.map(async (progress) => {
        const user = await authComponent.getAnyUserById(ctx, progress.ownerId);
        if (!user) return null;
        return {
          ownerId: progress.ownerId,
          name: user.name,
          trophies: progress.trophies,
          isCurrentPlayer: progress.ownerId === userId,
        };
      }),
    );
    return players
      .filter((player) => player !== null)
      .map((player, index) => ({ ...player, rank: index + 1 }));
  },
});

export const playerProfile = query({
  args: { ownerId: v.string() },
  handler: async (ctx, { ownerId }) => {
    await requirePlayer(ctx);
    const user = await authComponent.getAnyUserById(ctx, ownerId);
    if (!user) return null;
    const [deck, league, entries] = await Promise.all([
      currentDeck(ctx, ownerId),
      playerLeague(ctx, ownerId),
      ctx.db
        .query("collection")
        .withIndex("by_owner_variant", (q) => q.eq("ownerId", ownerId))
        .collect(),
    ]);
    // A read projection also supports players who have not migrated their old
    // collection yet. Their reserves and other collection cards remain private.
    const owned = new Map(
      catalogueMigration(entries).cards.map((entry) => [
        entry.variantId,
        entry,
      ]),
    );
    const cardIds = [...new Set(deck?.cardIds.map(canonicalVariantId) ?? [])];
    const cards = cardIds.flatMap((id) => {
      const entry = owned.get(id);
      return entry ? [resolveCard(id, entry.level, entry.soulbinds)] : [];
    });
    return {
      trophies: league.trophies,
      peakTrophies: league.peakTrophies,
      deckCapacity: league.deckCapacity,
      deck: deck ? { name: deck.name, cards } : null,
    };
  },
});

export const gold = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requirePlayer(ctx);
    return (await playerWallet(ctx, userId))?.gold ?? 0;
  },
});

export const diamonds = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requirePlayer(ctx);
    return (await playerWallet(ctx, userId))?.diamonds ?? 0;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requirePlayer(ctx);
    const owned = await ctx.db
      .query("collection")
      .withIndex("by_owner_variant", (q) => q.eq("ownerId", userId))
      .collect();
    return catalogueMigration(owned).cards.map((entry) => ({
      card: resolveCard(entry.variantId, entry.level, entry.soulbinds),
      copies: entry.copies,
    }));
  },
});

export const upgrade = mutation({
  args: { variantId: v.string() },
  handler: async (ctx, { variantId }) => {
    const { userId } = await requirePlayer(ctx);
    await migratePlayerCatalogue(ctx, userId);
    variantId = canonicalVariantId(variantId);
    const entry = await ownedCard(ctx, userId, variantId);
    if (!entry)
      throw new ConvexError("Cette carte n’est pas encore débloquée.");
    if (
      entry.level >=
      maxCardLevel(
        resolveCard(entry.variantId).rarity,
        entry.variantId.split(":")[0],
      )
    )
      throw new ConvexError("Cette carte a atteint le niveau maximal.");
    const current = rules(() => resolveCard(variantId, entry.level));
    const cost = upgradeCost(entry.level, current.rarity);
    if (entry.copies < cost)
      throw new ConvexError(
        "Tu n’as pas assez d’exemplaires pour cette amélioration.",
      );
    const goldCost = upgradeGoldCost(entry.level, current.rarity);
    const wallet = await playerWallet(ctx, userId);
    if (!wallet || wallet.gold < goldCost)
      throw new ConvexError(
        "Tu n’as pas assez de pièces d’or pour cette amélioration.",
      );
    const card = rules(() =>
      resolveCard(variantId, entry.level + 1, entry.soulbinds),
    );
    await ctx.db.patch(wallet._id, {
      gold: wallet.gold - goldCost,
      experience:
        (wallet.experience ?? 0) +
        upgradeExperience(entry.level, current.rarity),
    });
    await ctx.db.patch(entry._id, {
      level: entry.level + 1,
      copies: entry.copies - cost,
    });
    await recordMissionProgress(ctx, userId, { upgrades: 1 });
    await observeHero(ctx, userId);
    return { card, copies: entry.copies - cost, gold: wallet.gold - goldCost };
  },
});

export const soulProgress = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requirePlayer(ctx);
    const [wallet, league, collection] = await Promise.all([
      playerWallet(ctx, userId),
      playerLeague(ctx, userId),
      ctx.db
        .query("collection")
        .withIndex("by_owner_variant", (q) => q.eq("ownerId", userId))
        .collect(),
    ]);
    const projected = catalogueMigration(collection);
    return {
      ...rankProgress(wallet?.experience ?? projected.experience),
      soulDust: wallet?.soulDust ?? 0,
      unlocked: leagueAtIndex(league.peakTrophies) >= SOULBIND_LEAGUE_INDEX,
      evolutionUnlocked:
        leagueAtIndex(league.peakTrophies) >= EVOLUTION_LEAGUE_INDEX,
    };
  },
});

const leagueAtIndex = (trophies: number) => leagueAt(trophies).index;

export const soulbind = mutation({
  args: { variantId: v.string(), tier: v.number() },
  handler: async (ctx, { variantId, tier }) => {
    const { userId } = await requirePlayer(ctx);
    const wallet = (await migratePlayerCatalogue(ctx, userId, true))!;
    const [entries, league] = await Promise.all([
      ctx.db
        .query("collection")
        .withIndex("by_owner_variant", (q) => q.eq("ownerId", userId))
        .collect(),
      playerLeague(ctx, userId),
    ]);
    const collection = entries.map((entry) => ({
      card: resolveCard(entry.variantId, entry.level, entry.soulbinds),
      copies: entry.copies,
    }));
    const link = rules(() =>
      requireSoulbind(variantId, tier, collection, {
        rank: rankProgress(wallet.experience ?? 0).rank,
        soulDust: wallet.soulDust ?? 0,
        unlocked: leagueAtIndex(league.peakTrophies) >= SOULBIND_LEAGUE_INDEX,
      }),
    );
    const entry = await ownedCard(ctx, userId, variantId);
    const soulbinds = [...(entry!.soulbinds ?? []), tier].sort((a, b) => a - b);
    await ctx.db.patch(entry!._id, { soulbinds });
    await ctx.db.patch(wallet._id, {
      soulDust: (wallet.soulDust ?? 0) - link.cost,
    });
    await observeHero(ctx, userId);
    return {
      card: resolveCard(entry!.variantId, entry!.level, soulbinds),
      soulDust: (wallet.soulDust ?? 0) - link.cost,
    };
  },
});

export const sacrifice = mutation({
  args: { variantId: v.string(), batches: v.number() },
  handler: async (ctx, { variantId, batches }) => {
    const { userId } = await requirePlayer(ctx);
    const wallet = (await migratePlayerCatalogue(ctx, userId, true))!;
    const entry = await ownedCard(ctx, userId, variantId);
    if (!entry)
      throw new ConvexError("Cette carte n’est pas encore débloquée.");
    const conversion = rules(() =>
      dustConversion(resolveCard(entry.variantId).rarity!, batches),
    );
    if (entry.copies < conversion.copies)
      throw new ConvexError(
        "Tu n’as pas assez d’exemplaires en réserve pour cette conversion.",
      );
    const soulDust = (wallet.soulDust ?? 0) + conversion.soulDust;
    await ctx.db.patch(entry._id, { copies: entry.copies - conversion.copies });
    await ctx.db.patch(wallet._id, { soulDust });
    return { copies: entry.copies - conversion.copies, soulDust };
  },
});

export const evolve = mutation({
  args: { variantId: v.string(), targetId: v.string() },
  handler: async (ctx, { variantId, targetId }) => {
    const { userId } = await requirePlayer(ctx);
    await migratePlayerCatalogue(ctx, userId);
    const league = await playerLeague(ctx, userId);
    if (leagueAtIndex(league.peakTrophies) < EVOLUTION_LEAGUE_INDEX)
      throw new ConvexError(
        "L’évolution se débloque à partir de la ligue Or IV.",
      );
    const option = rules(() =>
      evolutionOptions(variantId).find((o) => o.variantId === targetId),
    );
    if (!option) throw new ConvexError("Cette évolution n’existe pas.");
    const [entry, target] = await Promise.all([
      ownedCard(ctx, userId, variantId),
      ownedCard(ctx, userId, targetId),
    ]);
    if (!entry)
      throw new ConvexError("Cette carte n’est pas encore débloquée.");
    if (!target)
      throw new ConvexError(
        "Découvre d’abord la carte de rareté supérieure pour pouvoir l’alimenter.",
      );
    if (entry.copies < option.cost)
      throw new ConvexError(
        "Tu n’as pas assez d’exemplaires pour cette évolution.",
      );
    await ctx.db.patch(entry._id, { copies: entry.copies - option.cost });
    await ctx.db.patch(target._id, { copies: target.copies + option.count });
    await recordMissionProgress(ctx, userId, { evolutions: 1 });
    return {
      variantId: target.variantId,
      count: option.count,
      copies: target.copies + option.count,
    };
  },
});
