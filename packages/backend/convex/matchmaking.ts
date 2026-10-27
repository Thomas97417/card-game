import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation } from "./_generated/server";
import {
  deckSnapshot,
  currentDeck,
  getActivity,
  requireIdle,
  requirePlayer,
  setActivity,
  startMatch,
} from "./lib/game_service";
import { readHeroProgress } from "./lib/heroes";
import { playerLeague } from "./lib/progression";
import type { Doc } from "./_generated/dataModel";

const LEASE_MS = 45_000;
export const enqueue = mutation({
  args: { deckId: v.id("decks") },
  handler: async (ctx, { deckId }) => {
    const user = await requirePlayer(ctx);
    await requireIdle(ctx, user.userId);
    const cards = await deckSnapshot(ctx, deckId, user.userId);
    const candidates = await ctx.db
      .query("matchmakingQueue")
      .order("asc")
      .filter((q) =>
        q.and(
          q.gt(q.field("expiresAt"), Date.now()),
          q.neq(q.field("userId"), user.userId),
        ),
      )
      .take(20);
    let opponent: Doc<"matchmakingQueue"> | undefined;
    for (const candidate of candidates) {
      const league = await playerLeague(ctx, candidate.userId);
      const deck = await currentDeck(ctx, candidate.userId);
      const snapshot =
        candidate.cards.length === 10
          ? candidate.cards.slice(0, league.deckCapacity)
          : candidate.cards;
      if (
        snapshot.length === league.deckCapacity &&
        deck?.cardIds.length === league.deckCapacity
      ) {
        opponent = { ...candidate, cards: snapshot };
        break;
      }
      await ctx.db.delete(candidate._id);
      const activity = await getActivity(ctx, candidate.userId);
      if (activity?.queueId === candidate._id)
        await setActivity(ctx, candidate.userId, {});
    }
    if (opponent) {
      const gameId = await ctx.db.insert("games", {
        mode: "public",
        hostId: opponent.userId,
        hostName: opponent.name,
        hostCards: opponent.cards,
        hostHeroLevel: opponent.heroLevel,
        status: "waiting",
      });
      await ctx.db.delete(opponent._id);
      await startMatch(ctx, gameId, user, cards);
      return { gameId };
    }
    const expiresAt = Date.now() + LEASE_MS;
    const queueId = await ctx.db.insert("matchmakingQueue", {
      ...user,
      cards,
      heroLevel: (await readHeroProgress(ctx, user.userId, cards)).level,
      expiresAt,
    });
    await setActivity(ctx, user.userId, { queueId });
    await ctx.scheduler.runAt(expiresAt, internal.matchmaking.expire, {
      queueId,
    });
    return { gameId: null };
  },
});
export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requirePlayer(ctx);
    const activity = await getActivity(ctx, user.userId);
    if (!activity?.queueId) return;
    const entry = await ctx.db.get(activity.queueId);
    if (entry && entry.expiresAt > Date.now()) {
      const league = await playerLeague(ctx, user.userId);
      const deck = await currentDeck(ctx, user.userId);
      const size =
        entry.cards.length === 10 ? league.deckCapacity : entry.cards.length;
      if (
        size !== league.deckCapacity ||
        deck?.cardIds.length !== league.deckCapacity
      ) {
        await ctx.db.delete(entry._id);
        await setActivity(ctx, user.userId, {});
        return;
      }
      await ctx.db.patch(entry._id, { expiresAt: Date.now() + LEASE_MS });
    }
  },
});
export const cancel = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requirePlayer(ctx);
    const activity = await getActivity(ctx, user.userId);
    if (activity?.queueId) {
      if (await ctx.db.get(activity.queueId))
        await ctx.db.delete(activity.queueId);
      await setActivity(ctx, user.userId, {});
    }
  },
});
export const expire = internalMutation({
  args: { queueId: v.id("matchmakingQueue") },
  handler: async (ctx, { queueId }): Promise<void> => {
    const entry = await ctx.db.get(queueId);
    if (!entry) return;
    if (entry.expiresAt > Date.now()) {
      await ctx.scheduler.runAt(entry.expiresAt, internal.matchmaking.expire, {
        queueId,
      });
      return;
    }
    await ctx.db.delete(queueId);
    const activity = await getActivity(ctx, entry.userId);
    if (activity?.queueId === queueId) await setActivity(ctx, entry.userId, {});
  },
});
