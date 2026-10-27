import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGame, DEFAULT_DECK, surrender, validateDeck } from "@sylve/game";
import { internal } from "../convex/_generated/api";
import { COMBAT_EVENT_RETENTION_MS } from "../convex/lib/combat_retention";
import { saveTransition } from "../convex/lib/game_service";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const setup = () => convexTest(schema, modules);
type Test = ReturnType<typeof setup>;

async function match(t: Test, { finished = false, legacy = false, events = 3 } = {}) {
  return await t.run(async (ctx) => {
    const cards = validateDeck(DEFAULT_DECK);
    const state = createGame([
      { userId: "alice", name: "Alice", cards },
      { userId: "bob", name: "Bob", cards },
    ], Date.now(), () => 0.25);
    const gameId = await ctx.db.insert("games", {
      mode: "private", hostId: "alice", hostName: "Alice", hostCards: cards,
      guestId: "bob", status: finished ? "finished" : "active",
      state: finished ? surrender(state, 1).state : state,
      ...(finished && !legacy ? { finishedAt: Date.now() } : {}),
      soloRecentCards: [cards[0]!.id],
      trophyChanges: [{ ownerId: "alice", trophies: 10, trophiesTotal: 110,
        previousTrophies: 100, deckCapacity: 4, deckSlotsGained: 0 }],
      reward: { ownerId: "alice", status: "lost", victoryWins: 2 },
    });
    for (let seq = 1; seq <= events; seq++)
      await ctx.db.insert("gameEvents", { gameId, seq,
        event: { seq, type: "turn", player: seq % 2 } });
    return gameId;
  });
}
async function logs(t: Test, gameId: Awaited<ReturnType<typeof match>>) {
  return await t.run((ctx) => ctx.db.query("gameEvents")
    .withIndex("by_game_seq", (q) => q.eq("gameId", gameId)).collect());
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("combat event retention", () => {
  it("schedules cleanup at the end, leaves time for playback and preserves the result", async () => {
    const t = setup();
    const gameId = await match(t);
    await t.run(async (ctx) => {
      const game = (await ctx.db.get(gameId))!;
      await saveTransition(ctx, gameId, surrender(game.state!, 1));
    });
    const finished = (await t.run((ctx) => ctx.db.get(gameId)))!;
    expect(finished.finishedAt).toBe(Date.now());
    expect(await logs(t, gameId)).toHaveLength(4);
    await t.mutation(internal.combatCleanup.purgeEvents, { gameId });
    await vi.advanceTimersByTimeAsync(COMBAT_EVENT_RETENTION_MS - 1);
    await t.finishInProgressScheduledFunctions();
    expect(await logs(t, gameId)).toHaveLength(4);
    await vi.advanceTimersByTimeAsync(1);
    await t.finishInProgressScheduledFunctions();
    expect(await logs(t, gameId)).toEqual([]);
    const purged = (await t.run((ctx) => ctx.db.get(gameId)))!;
    expect(purged).toMatchObject({
      state: finished.state, status: "finished", eventsPurged: true,
      reward: finished.reward, trophyChanges: finished.trophyChanges,
    });
    expect(purged.soloRecentCards).toBeUndefined();
    await t.mutation(internal.combatCleanup.purgeEvents, { gameId });
    expect(await t.run((ctx) => ctx.db.get(gameId))).toEqual(purged);
  });

  it("never purges a live match, even after the retention period", async () => {
    const t = setup();
    const gameId = await match(t);
    await vi.advanceTimersByTimeAsync(COMBAT_EVENT_RETENTION_MS * 2);
    await t.mutation(internal.combatCleanup.purgeEvents, { gameId });
    await t.mutation(internal.combatCleanup.sweepFinishedGames, {});
    await t.finishInProgressScheduledFunctions();
    expect(await logs(t, gameId)).toHaveLength(3);
    expect((await t.run((ctx) => ctx.db.get(gameId)))!.eventsPurged).toBeUndefined();
  });

  it("sweeps legacy finished matches in bounded batches without touching recent or live matches", async () => {
    const t = setup();
    const legacyId = await match(t, { finished: true, legacy: true, events: 300 });
    const otherLegacyIds = [];
    for (let i = 0; i < 16; i++)
      otherLegacyIds.push(await match(t, { finished: true, legacy: true, events: 1 }));
    const recentId = await match(t, { finished: true });
    const liveId = await match(t);
    await t.mutation(internal.combatCleanup.sweepFinishedGames, {});
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await logs(t, legacyId)).toEqual([]);
    expect((await t.run((ctx) => ctx.db.get(legacyId)))!.eventsPurged).toBe(true);
    for (const gameId of otherLegacyIds) {
      expect(await logs(t, gameId)).toEqual([]);
      expect((await t.run((ctx) => ctx.db.get(gameId)))!.eventsPurged).toBe(true);
    }
    expect(await logs(t, recentId)).toHaveLength(3);
    expect(await logs(t, liveId)).toHaveLength(3);
  });
});
