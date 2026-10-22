import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DECK, MAX_CARD_LEVEL, getCombatType } from "@sylve/game";
import { CHEST_RULES } from "@sylve/game/progression";
import { PRACTICE_DEADLINE } from "@sylve/game/practice";
import { api, components, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
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
        expiresAt: Date.now() + 86_400_000,
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
  return { t, alice, deckId };
}
async function winSolo(t: Test, alice: Player, deckId: Id<"decks">) {
  const gameId = await alice.mutation(api.games.createSolo, { deckId });
  await t.run(async (ctx) => {
    const game = (await ctx.db.get(gameId))!;
    const state = game.state!;
    state.players[1]!.heroHp = 1;
    await ctx.db.patch(gameId, { state });
  });
  const view = await alice.query(api.games.get, { gameId });
  const card = view.players[0]!.hand[0]!;
  await alice.mutation(api.games.playCard, {
    gameId,
    cardId: card.id,
    row: 0,
    depth: getCombatType(card) === "melee" ? 0 : 2,
    expectedTurn: 1,
  });
  return gameId;
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("collection autoritaire", () => {
  it("initializes exactly four common variants once", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    await expect(t.query(api.collection.list, {})).rejects.toThrow(
      "Connecte-toi",
    );
    const deckId = await alice.mutation(api.decks.ensureStarter, {});
    const userId = await t.run(
      async (ctx) => (await ctx.db.get(deckId))!.ownerId,
    );
    const entries = await alice.query(api.collection.list, {});
    expect(entries.map((entry) => entry.card.id).sort()).toEqual(
      [...DEFAULT_DECK].sort(),
    );
    expect(
      entries.every(
        (entry) =>
          entry.card.rarity === "common" &&
          entry.card.level === 1 &&
          entry.copies === 0,
      ),
    ).toBe(true);
    await Promise.all(
      Array.from({ length: 3 }, () =>
        alice.mutation(api.decks.ensureStarter, {}),
      ),
    );
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("collection")
          .withIndex("by_owner_variant", (q) => q.eq("ownerId", userId))
          .collect(),
      ),
    ).toHaveLength(4);
  });
  it("replaces a pre-progression deck once and preserves subsequent progress", async () => {
    const { t, alice, deckId } = await fixture();
    await t.run(async (ctx) => {
      const deck = (await ctx.db.get(deckId))!;
      for (const entry of await ctx.db
        .query("collection")
        .withIndex("by_owner_variant", (q) => q.eq("ownerId", deck.ownerId))
        .collect())
        await ctx.db.delete(entry._id);
      await ctx.db.patch(deckId, {
        cardIds: [
          "guardian",
          "fox",
          "owl",
          "stag",
          "mushroom",
          "dragon",
          "turtle",
          "wisp",
        ],
      });
    });
    await alice.mutation(api.decks.ensureStarter, {});
    expect((await alice.query(api.decks.list, {}))[0]!.cardIds).toEqual(
      DEFAULT_DECK,
    );
    await t.run(async (ctx) => {
      const deck = (await ctx.db.get(deckId))!;
      const entry = (await ctx.db
        .query("collection")
        .withIndex("by_owner_variant", (q) =>
          q.eq("ownerId", deck.ownerId).eq("variantId", "guardian:common"),
        )
        .unique())!;
      await ctx.db.patch(entry._id, { level: 2, copies: 3 });
    });
    await alice.mutation(api.decks.ensureStarter, {});
    expect(
      (await alice.query(api.collection.list, {})).find(
        (entry) => entry.card.id === "guardian:common",
      ),
    ).toMatchObject({ copies: 3, card: { level: 2 } });
  });
  it("cannot spend the same duplicates in two concurrent upgrades", async () => {
    const { t, alice, deckId } = await fixture();
    await t.run(async (ctx) => {
      const deck = (await ctx.db.get(deckId))!;
      const entry = (await ctx.db
        .query("collection")
        .withIndex("by_owner_variant", (q) =>
          q.eq("ownerId", deck.ownerId).eq("variantId", "guardian:common"),
        )
        .unique())!;
      await ctx.db.patch(entry._id, { copies: 5 });
    });
    const results = await Promise.allSettled([
      alice.mutation(api.collection.upgrade, { variantId: "guardian:common" }),
      alice.mutation(api.collection.upgrade, { variantId: "guardian:common" }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      (await alice.query(api.collection.list, {})).find(
        (entry) => entry.card.id === "guardian:common",
      ),
    ).toMatchObject({ copies: 0, card: { level: 2 } });
  });
  it("rejects unowned variants, another player's cards, insufficient copies and levels past ten", async () => {
    const { t, alice, deckId } = await fixture();
    const bob = await player(t, "bob");
    await expect(
      alice.mutation(api.decks.save, {
        deckId,
        name: "Deck",
        cardIds: [...DEFAULT_DECK, "fox:legendary"],
      }),
    ).rejects.toThrow("débloquée");
    await expect(
      alice.mutation(api.collection.upgrade, { variantId: DEFAULT_DECK[0]! }),
    ).rejects.toThrow("assez");
    await expect(
      bob.mutation(api.collection.upgrade, { variantId: DEFAULT_DECK[0]! }),
    ).rejects.toThrow("débloquée");
    await expect(
      alice.mutation(api.collection.upgrade, { variantId: "fox:rare" }),
    ).rejects.toThrow("débloquée");
    await t.run(async (ctx) => {
      const deck = (await ctx.db.get(deckId))!;
      const owned = (await ctx.db
        .query("collection")
        .withIndex("by_owner_variant", (q) =>
          q.eq("ownerId", deck.ownerId).eq("variantId", DEFAULT_DECK[0]!),
        )
        .unique())!;
      await ctx.db.patch(owned._id, { level: MAX_CARD_LEVEL, copies: 100 });
    });
    await expect(
      alice.mutation(api.collection.upgrade, { variantId: DEFAULT_DECK[0]! }),
    ).rejects.toThrow("maximal");
    expect(
      (await alice.query(api.collection.list, {})).find(
        (entry) => entry.card.id === DEFAULT_DECK[0],
      )!.copies,
    ).toBe(100);
  });
});

describe("victoires, coffres et améliorations", () => {
  it("opens once at the server deadline, unlocks variants, consumes duplicates and snapshots upgraded stats", async () => {
    const { t, alice, deckId } = await fixture();
    const bob = await player(t, "bob");
    const gameId = await winSolo(t, alice, deckId);
    const original = await alice.query(api.games.get, { gameId });
    expect(original.reward?.status).toBe("awarded");
    const chest = (await alice.query(api.chests.list, {})).chests[0]!;
    expect(chest).not.toHaveProperty("contents");
    expect(chest).not.toHaveProperty("reveals");
    const unlockAt = Date.now() + 15 * 60_000;
    await t.run((ctx) =>
      ctx.db.patch(chest._id, {
        rarity: "rare",
        unlockAt,
        contents: [
          { variantId: "guardian:common", count: 7 },
          { variantId: "fox:rare", count: 3 },
          { variantId: "fox:epic", count: 2 },
        ],
      }),
    );
    await expect(
      bob.mutation(api.chests.open, { chestId: chest._id }),
    ).rejects.toThrow("appartient");
    await expect(
      alice.mutation(api.chests.open, { chestId: chest._id }),
    ).rejects.toThrow("prêt");
    vi.setSystemTime(unlockAt);
    const results = await Promise.all([
      alice.mutation(api.chests.open, { chestId: chest._id }),
      alice.mutation(api.chests.open, { chestId: chest._id }),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(
      results[0]!.reveals
        .filter((item) => item.isNew)
        .map((item) => item.variantId)
        .sort(),
    ).toEqual(["fox:epic", "fox:rare"]);
    expect((await alice.query(api.chests.list, {})).chests).toHaveLength(0);
    let entries = await alice.query(api.collection.list, {});
    expect(
      entries.find((entry) => entry.card.id === "guardian:common")!.copies,
    ).toBe(7);
    expect(entries.find((entry) => entry.card.id === "fox:rare")!.copies).toBe(
      2,
    );
    expect(entries.find((entry) => entry.card.id === "fox:epic")!.copies).toBe(
      1,
    );
    await alice.mutation(api.collection.upgrade, {
      variantId: "guardian:common",
    });
    entries = await alice.query(api.collection.list, {});
    expect(
      entries.find((entry) => entry.card.id === "guardian:common"),
    ).toMatchObject({
      copies: 2,
      card: { level: 2, rarity: "common", attack: 3, health: 11 },
    });
    expect(
      entries.find((entry) => entry.card.id === "fox:rare")!.card.level,
    ).toBe(1);
    await alice.mutation(api.chests.open, { chestId: chest._id });
    expect(
      (await alice.query(api.collection.list, {})).find(
        (entry) => entry.card.id === "guardian:common",
      )!.copies,
    ).toBe(2);
    await alice.mutation(api.decks.save, {
      deckId,
      name: "Les variantes",
      cardIds: [...DEFAULT_DECK, "fox:rare", "fox:epic"],
    });
    const nextId = await alice.mutation(api.games.createSolo, { deckId });
    const next = await alice.query(api.games.get, { gameId: nextId });
    expect(next.players[0]!.deck).toHaveLength(6);
    expect(
      next.players[0]!.deck.find((card) => card.id === "guardian:common")!
        .attack,
    ).toBe(3);
    expect(
      original.players[0]!.deck.find((card) => card.id === "guardian:common")!
        .attack,
    ).toBe(2);
    expect(
      next.players[1]!.deck.map(
        (card) => `${card.rarity}:${card.level}`,
      ).sort(),
    ).toEqual(
      next.players[0]!.deck.map(
        (card) => `${card.rarity}:${card.level}`,
      ).sort(),
    );
  });
  it("runs four parallel timers, loses the fifth reward even if chests are ready and reuses a released slot", async () => {
    const { t, alice, deckId } = await fixture();
    for (let i = 0; i < 4; i++) await winSolo(t, alice, deckId);
    const inventory = await alice.query(api.chests.list, {});
    expect(inventory.chests.map((chest) => chest.slot).sort()).toEqual([
      0, 1, 2, 3,
    ]);
    const stored = await t.run((ctx) => ctx.db.query("chests").collect());
    expect(new Set(stored.map((chest) => chest.awardedAt)).size).toBe(1);
    for (const chest of stored)
      expect(chest.unlockAt - chest.awardedAt).toBe(
        CHEST_RULES[chest.rarity].durationMs,
      );
    vi.setSystemTime(Date.now() + 8 * 3_600_000);
    const lostGame = await winSolo(t, alice, deckId);
    expect(
      (await alice.query(api.games.get, { gameId: lostGame })).reward?.status,
    ).toBe("lost");
    expect((await alice.query(api.chests.list, {})).chests).toHaveLength(4);
    await expect(
      alice.mutation(api.games.surrender, { gameId: lostGame }),
    ).rejects.toThrow("terminée");
    await alice.mutation(api.chests.open, {
      chestId: inventory.chests[0]!._id,
    });
    await winSolo(t, alice, deckId);
    const next = (await alice.query(api.chests.list, {})).chests;
    expect(next).toHaveLength(4);
    expect(
      next.some(
        (chest) =>
          chest.slot === inventory.chests[0]!.slot &&
          chest._id !== inventory.chests[0]!._id,
      ),
    ).toBe(true);
  });
  it("rewards only public winners, with no chest for private matches, losers or surrendering solo players", async () => {
    const { t, alice, deckId } = await fixture();
    const bob = await player(t, "bob");
    const bobDeck = await bob.mutation(api.decks.ensureStarter, {});
    const room = await alice.mutation(api.games.createPrivate, { deckId });
    await bob.mutation(api.games.joinPrivate, {
      code: room.code,
      deckId: bobDeck,
    });
    await bob.mutation(api.games.surrender, { gameId: room.gameId });
    expect((await alice.query(api.chests.list, {})).chests).toHaveLength(0);
    await alice.mutation(api.matchmaking.enqueue, { deckId });
    const matched = await bob.mutation(api.matchmaking.enqueue, {
      deckId: bobDeck,
    });
    await bob.mutation(api.games.surrender, { gameId: matched.gameId! });
    expect((await alice.query(api.chests.list, {})).chests).toHaveLength(1);
    expect((await bob.query(api.chests.list, {})).chests).toHaveLength(0);
    expect(
      (await bob.query(api.games.get, { gameId: matched.gameId! })).reward,
    ).toBeNull();
    const solo = await alice.mutation(api.games.createSolo, { deckId });
    await alice.mutation(api.games.surrender, { gameId: solo });
    expect((await alice.query(api.chests.list, {})).chests).toHaveLength(1);
  });
  it("freezes queued card stats while later improvements affect future matches", async () => {
    const { t, alice, deckId } = await fixture();
    const bob = await player(t, "bob");
    const bobDeck = await bob.mutation(api.decks.ensureStarter, {});
    await t.run(async (ctx) => {
      const deck = (await ctx.db.get(deckId))!;
      const owned = (await ctx.db
        .query("collection")
        .withIndex("by_owner_variant", (q) =>
          q.eq("ownerId", deck.ownerId).eq("variantId", "guardian:common"),
        )
        .unique())!;
      await ctx.db.patch(owned._id, { copies: 5 });
    });
    await alice.mutation(api.matchmaking.enqueue, { deckId });
    await alice.mutation(api.collection.upgrade, {
      variantId: "guardian:common",
    });
    const match = await bob.mutation(api.matchmaking.enqueue, {
      deckId: bobDeck,
    });
    const view = await alice.query(api.games.get, { gameId: match.gameId! });
    expect(
      view.players[0]!.deck.find((card) => card.id === "guardian:common")!
        .level,
    ).toBe(1);
    expect(
      (await alice.query(api.collection.list, {})).find(
        (entry) => entry.card.id === "guardian:common",
      )!.card.level,
    ).toBe(2);
  });
});

describe("solo persistant", () => {
  it("starts the human with no deadline, protects bot moves, resumes and ignores duplicate or obsolete turns", async () => {
    const { t, alice, deckId } = await fixture();
    const bob = await player(t, "bob");
    const gameId = await alice.mutation(api.games.createSolo, { deckId });
    let view = await alice.query(api.games.get, { gameId });
    expect(view.mode).toBe("solo");
    expect(view.activePlayer).toBe(0);
    expect(view.turnEndsAt).toBe(PRACTICE_DEADLINE);
    expect((await alice.query(api.games.activity, {})).gameId).toBe(gameId);
    await expect(
      alice.mutation(api.games.createSolo, { deckId }),
    ).rejects.toThrow("déjà");
    await expect(
      bob.mutation(api.games.soloTurn, { gameId, expectedTurn: 1 }),
    ).rejects.toThrow("appartient");
    const card = view.players[0]!.hand[0]!;
    await alice.mutation(api.games.playCard, {
      gameId,
      cardId: card.id,
      row: 0,
      depth: getCombatType(card) === "melee" ? 0 : 2,
      expectedTurn: 1,
    });
    view = await alice.query(api.games.get, { gameId });
    expect(view.activePlayer).toBe(1);
    await Promise.all([
      alice.mutation(api.games.soloTurn, { gameId, expectedTurn: 2 }),
      alice.mutation(api.games.soloTurn, { gameId, expectedTurn: 2 }),
    ]);
    expect((await alice.query(api.games.get, { gameId })).turn).toBe(3);
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    await t.mutation(internal.games.expireTurn, { gameId, expectedTurn: 3 });
    view = await alice.query(api.games.get, { gameId });
    expect(view.turn).toBe(3);
    expect(view.activePlayer).toBe(0);
    expect(view.turnEndsAt).toBe(PRACTICE_DEADLINE);
  });
  it("plays the bot after ten seconds when the client disappears", async () => {
    const { t, alice, deckId } = await fixture();
    const gameId = await alice.mutation(api.games.createSolo, { deckId });
    const view = await alice.query(api.games.get, { gameId });
    const card = view.players[0]!.hand[0]!;
    await alice.mutation(api.games.playCard, {
      gameId,
      cardId: card.id,
      row: 0,
      depth: getCombatType(card) === "melee" ? 0 : 2,
      expectedTurn: 1,
    });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const restored = await alice.query(api.games.get, { gameId });
    expect(restored.turn).toBe(3);
    expect(restored.activePlayer).toBe(0);
    expect(restored.players[1]!.board).toHaveLength(1);
  });
});
