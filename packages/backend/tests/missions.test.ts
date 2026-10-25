import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DECK, getCombatType } from "@sylve/game";
import { api, components } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { recordMissionProgress } from "../convex/lib/missions";

const modules = import.meta.glob("../convex/**/*.ts");
function setup() {
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
  return t;
}
type Test = ReturnType<typeof setup>;
async function player(t: Test, name: string) {
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "user",
      data: {
        name,
        email: `${name}@example.invalid`,
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    },
  });
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "session",
      data: {
        userId: user._id,
        token: `${name}-session`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() + 90 * 86_400_000,
      },
    },
  });
  return t.withIdentity({ subject: user._id, sessionId: session._id });
}
type Player = Awaited<ReturnType<typeof player>>;
async function fixture() {
  const t = setup();
  const alice = await player(t, "alice");
  const deckId = await alice.mutation(api.decks.ensureStarter, {});
  const ownerId = (await t.run((ctx) => ctx.db.get(deckId)))!.ownerId;
  return { t, alice, deckId, ownerId };
}
const board = (client: Player) =>
  client.query(api.missions.board, { refreshKey: "test" });
async function winSolo(t: Test, client: Player, deckId: Id<"decks">) {
  const gameId = await client.mutation(api.games.createSolo, { deckId });
  await t.run(async (ctx) => {
    const game = (await ctx.db.get(gameId))!;
    const state = game.state!;
    state.players[1]!.heroHp = 1;
    for (const player of state.players) {
      player.board = [];
      player.runes = [];
      player.pentagrams = [];
    }
    await ctx.db.patch(gameId, { state });
  });
  const view = await client.query(api.games.get, { gameId });
  const card = view.players[0]!.hand[0]!;
  await client.mutation(api.games.playCard, {
    gameId,
    cardId: card.id,
    row: 0,
    depth: getCombatType(card) === "melee" ? 0 : 2,
    expectedTurn: 1,
  });
  return gameId;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-21T23:50:00Z"));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("missions persistantes", () => {
  it("requires authentication and rejects unfinished missions and forged rewards", async () => {
    const { t, alice } = await fixture();
    await expect(board(t)).rejects.toThrow("Connecte-toi");
    const initial = await board(alice);
    expect(initial.hasClaimable).toBe(false);
    const args = {
      missionId: "daily-battle",
      tier: 0,
      periodKey: initial.daily.key,
    };
    await expect(alice.mutation(api.missions.claim, args)).rejects.toThrow(
      "pas encore terminée",
    );
    await expect(
      alice.mutation(api.missions.claim, { ...args, missionId: "invented" }),
    ).rejects.toThrow("introuvable");
    await expect(
      alice.mutation(api.missions.claim, { ...args, tier: -1 }),
    ).rejects.toThrow("invalide");
    await expect(
      alice.mutation(api.missions.openChest, {
        kind: "daily",
        periodKey: initial.daily.key,
        index: 0,
      }),
    ).rejects.toThrow("davantage de sceaux");
    await expect(
      alice.mutation(api.missions.openChest, {
        kind: "daily",
        periodKey: initial.daily.key,
        index: -1,
      }),
    ).rejects.toThrow("introuvable");
  });

  it("counts an actual solo victory and deployment once in all three tracks", async () => {
    const { t, alice, deckId, ownerId } = await fixture();
    const gameId = await winSolo(t, alice, deckId);
    const view = await board(alice);
    expect(
      view.daily.missions.slice(0, 3).map((item) => item.progress),
    ).toEqual([1, 1, 1]);
    expect(
      view.weekly.missions.slice(0, 3).map((item) => item.progress),
    ).toEqual([1, 1, 1]);
    expect(view.daily.seals).toBe(0);
    expect(view.hasClaimable).toBe(true);
    await expect(
      alice.mutation(api.games.playCard, {
        gameId,
        cardId: "guardian:common",
        row: 0,
        depth: 0,
        expectedTurn: 1,
      }),
    ).rejects.toThrow();
    const rows = await t.run((ctx) =>
      ctx.db.query("missionProgress").collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ownerId,
      lifetime: { battles: 1, wins: 1, cardsPlayed: 1 },
    });
  });

  it("claims seals and opens real loot only once under concurrent requests, without consuming the road", async () => {
    const { t, alice, deckId } = await fixture();
    await winSolo(t, alice, deckId);
    const periodKey = (await board(alice)).daily.key;
    const args = { missionId: "daily-battle", tier: 0, periodKey };
    await Promise.all([
      alice.mutation(api.missions.claim, args),
      alice.mutation(api.missions.claim, args),
    ]);
    expect((await board(alice)).daily.seals).toBe(20);
    const chestArgs = { kind: "daily" as const, periodKey, index: 0 };
    const opened = await Promise.all([
      alice.mutation(api.missions.openChest, chestArgs),
      alice.mutation(api.missions.openChest, chestArgs),
    ]);
    expect(opened[0]).toEqual(opened[1]);
    expect(opened[0]!.gold).toBeGreaterThan(0);
    expect(opened[0]!.reveals.length).toBeGreaterThan(0);
    expect(await alice.query(api.collection.gold, {})).toBe(opened[0]!.gold);
    const view = await board(alice);
    expect(view.daily.seals).toBe(20);
    expect(view.daily.chests[0]!.status).toBe("claimed");
    expect(
      view.daily.missions.find((item) => item.id === "daily-chest")!.status,
    ).toBe("ready");
    const saved = await t.run((ctx) =>
      ctx.db.query("missionProgress").unique(),
    );
    expect(saved!.lifetime.chestsOpened).toBe(1);
    const bob = await player(t, "bob");
    await expect(
      bob.mutation(api.missions.openChest, chestArgs),
    ).rejects.toThrow("davantage de sceaux");
    expect((await board(bob)).hasClaimable).toBe(false);
  });

  it("advances epic tiers manually, pays more emeralds and never lets a stale retry claim the next tier", async () => {
    const { t, alice, ownerId } = await fixture();
    await t.run(async (ctx) => {
      await recordMissionProgress(ctx, ownerId, { wins: 30 });
      await ctx.db.insert("wallets", { ownerId, gold: 0, diamonds: 0 });
    });
    const args = { missionId: "epic-wins", periodKey: "lifetime", tier: 0 };
    await Promise.all([
      alice.mutation(api.missions.claim, args),
      alice.mutation(api.missions.claim, args),
    ]);
    expect(await alice.query(api.collection.diamonds, {})).toBe(15);
    expect((await board(alice)).epic[0]).toMatchObject({
      tier: 1,
      target: 15,
      reward: 30,
      progress: 15,
      status: "ready",
    });
    await alice.mutation(api.missions.claim, { ...args, tier: 1 });
    expect(await alice.query(api.collection.diamonds, {})).toBe(45);
    await alice.mutation(api.missions.claim, args);
    expect(await alice.query(api.collection.diamonds, {})).toBe(45);
    await alice.mutation(api.missions.claim, { ...args, tier: 2 });
    expect(await alice.query(api.collection.diamonds, {})).toBe(90);
    expect((await board(alice)).epic[0]).toMatchObject({
      tier: 3,
      target: 50,
      reward: 60,
      progress: 30,
      status: "active",
    });
    await expect(
      alice.mutation(api.missions.claim, { ...args, tier: 3 }),
    ).rejects.toThrow("pas encore terminé");
  });

  it("expires yesterday's claims and chests, retains the week, then resets it on Monday", async () => {
    const { t, alice, ownerId } = await fixture();
    await t.run((ctx) =>
      recordMissionProgress(ctx, ownerId, { battles: 15, wins: 8 }),
    );
    const previous = await board(alice);
    await alice.mutation(api.missions.claim, {
      missionId: "daily-battle",
      tier: 0,
      periodKey: previous.daily.key,
    });
    await alice.mutation(api.missions.claim, {
      missionId: "weekly-battles",
      tier: 0,
      periodKey: previous.weekly.key,
    });
    vi.setSystemTime(new Date("2026-10-22T00:00:00Z"));
    let current = await board(alice);
    expect(current.daily.seals).toBe(0);
    expect(current.daily.missions[0]!.status).toBe("active");
    expect(current.weekly.seals).toBe(100);
    expect(current.epic[0]!.progress).toBe(5);
    await expect(
      alice.mutation(api.missions.claim, {
        missionId: "daily-battle",
        tier: 0,
        periodKey: previous.daily.key,
      }),
    ).rejects.toThrow("expiré");
    await expect(
      alice.mutation(api.missions.openChest, {
        kind: "daily",
        periodKey: previous.daily.key,
        index: 0,
      }),
    ).rejects.toThrow("expiré");
    await t.run((ctx) => recordMissionProgress(ctx, ownerId, { battles: 1 }));
    expect((await board(alice)).daily.missions[0]!.status).toBe("ready");
    vi.setSystemTime(new Date("2026-10-26T00:00:00Z"));
    current = await board(alice);
    expect(current.weekly.seals).toBe(0);
    expect(current.weekly.missions[0]!.progress).toBe(0);
    expect(current.epic[1]!.progress).toBe(10);
  });

  it("excludes friendly duels and counts both public players, including the defeated player", async () => {
    const { t, alice, deckId } = await fixture();
    const bob = await player(t, "bob");
    const bobDeck = await bob.mutation(api.decks.ensureStarter, {});
    const room = await alice.mutation(api.games.createPrivate, { deckId });
    await bob.mutation(api.games.joinPrivate, {
      code: room.code,
      deckId: bobDeck,
    });
    await bob.mutation(api.games.surrender, { gameId: room.gameId });
    expect((await board(alice)).hasClaimable).toBe(false);
    expect((await board(bob)).hasClaimable).toBe(false);
    await alice.mutation(api.matchmaking.enqueue, { deckId });
    const match = await bob.mutation(api.matchmaking.enqueue, {
      deckId: bobDeck,
    });
    await bob.mutation(api.games.surrender, { gameId: match.gameId! });
    expect(
      (await board(alice)).daily.missions
        .slice(0, 2)
        .map((item) => item.progress),
    ).toEqual([1, 1]);
    expect(
      (await board(bob)).daily.missions
        .slice(0, 2)
        .map((item) => item.progress),
    ).toEqual([1, 0]);
  });

  it("tracks successful upgrades, evolutions and individual summons, never failed actions or summon retries", async () => {
    const { t, alice, ownerId } = await fixture();
    await expect(
      alice.mutation(api.collection.upgrade, { variantId: DEFAULT_DECK[0]! }),
    ).rejects.toThrow();
    await t.run(async (ctx) => {
      const cards = await ctx.db.query("collection").collect();
      for (const card of cards) await ctx.db.patch(card._id, { copies: 100 });
      await ctx.db.insert("wallets", {
        ownerId,
        gold: 100000,
        diamonds: 50000,
        catalogueVersion: 2,
      });
      await ctx.db.insert("leagueProgress", {
        ownerId,
        trophies: 2400,
        peakTrophies: 2400,
      });
      await ctx.db.insert("collection", {
        ownerId,
        variantId: "guardian:rare",
        level: 1,
        copies: 100,
      });
      await ctx.db.insert("collection", {
        ownerId,
        variantId: "guardian:epic",
        level: 1,
        copies: 0,
      });
    });
    await alice.mutation(api.collection.upgrade, {
      variantId: DEFAULT_DECK[0]!,
    });
    await alice.mutation(api.collection.evolve, {
      variantId: "guardian:rare",
      targetId: "guardian:epic",
    });
    const summon = {
      packId: "sylve" as const,
      count: 10 as const,
      requestId: "mission-test-summon-0001",
    };
    await alice.mutation(api.sanctuary.summon, summon);
    await alice.mutation(api.sanctuary.summon, summon);
    const saved = await t.run((ctx) =>
      ctx.db.query("missionProgress").unique(),
    );
    expect(saved!.lifetime).toMatchObject({
      upgrades: 1,
      evolutions: 1,
      summons: 10,
    });
    expect(
      (await board(alice)).daily.missions.find(
        (item) => item.id === "daily-upgrade",
      )!.status,
    ).toBe("ready");
  });
});
