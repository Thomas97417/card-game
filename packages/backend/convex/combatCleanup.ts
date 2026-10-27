import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { COMBAT_EVENT_RETENTION_MS } from "./lib/combat_retention";

const EVENT_BATCH_SIZE = 128;
const GAME_BATCH_SIZE = 16;

/** Keep the result and reward references; only the transient combat log expires. */
export const purgeEvents = internalMutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const game = await ctx.db.get(gameId);
    if (!game || game.status !== "finished" || game.eventsPurged) return;
    const remaining =
      (game.finishedAt ?? 0) + COMBAT_EVENT_RETENTION_MS - Date.now();
    if (remaining > 0) {
      await ctx.scheduler.runAfter(
        remaining, internal.combatCleanup.purgeEvents, { gameId },
      );
      return;
    }
    const events = await ctx.db
      .query("gameEvents")
      .withIndex("by_game_seq", (q) => q.eq("gameId", gameId))
      .take(EVENT_BATCH_SIZE);
    for (const event of events) await ctx.db.delete(event._id);
    if (events.length === EVENT_BATCH_SIZE) {
      await ctx.scheduler.runAfter(
        0, internal.combatCleanup.purgeEvents, { gameId },
      );
    } else {
      await ctx.db.patch(gameId, {
        eventsPurged: true,
        soloRecentCards: undefined,
      });
    }
  },
});

/** Also reclaim logs from matches completed before automatic cleanup existed. */
export const sweepFinishedGames = internalMutation({
  args: {},
  handler: async (ctx) => {
    const games = await ctx.db
      .query("games")
      .withIndex("by_event_cleanup", (q) =>
        q.eq("status", "finished")
          .eq("eventsPurged", undefined)
          .lt("finishedAt", Date.now() - COMBAT_EVENT_RETENTION_MS),
      )
      .take(GAME_BATCH_SIZE);
    for (const game of games)
      await ctx.scheduler.runAfter(0, internal.combatCleanup.purgeEvents, {
        gameId: game._id,
      });
    if (games.length === GAME_BATCH_SIZE)
      await ctx.scheduler.runAfter(
        60_000, internal.combatCleanup.sweepFinishedGames, {},
      );
  },
});
