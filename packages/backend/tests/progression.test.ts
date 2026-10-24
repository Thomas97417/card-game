import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DECK,
  CATALOG,
  MAX_CARD_LEVEL,
  RARITIES,
  getCombatType,
  resolveCard,
  legalPlacements,
  upgradeCost,
  upgradeGoldCost,
} from "@sylve/game";
import { CHEST_RULES, CHEST_SLOTS } from "@sylve/game/progression";
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
async function setTrophies(t: Test, deckId: Id<"decks">, trophies: number) {
  await t.run(async (ctx) => {
    const { ownerId } = (await ctx.db.get(deckId))!;
    const progress = await ctx.db
      .query("leagueProgress")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .unique();
    if (progress) await ctx.db.patch(progress._id, { trophies });
    else await ctx.db.insert("leagueProgress", { ownerId, trophies });
  });
}
async function winSolo(t: Test, alice: Player, deckId: Id<"decks">) {
  const gameId = await alice.mutation(api.games.createSolo, { deckId });
  await t.run(async (ctx) => {
    const game = (await ctx.db.get(gameId))!;
    const state = game.state!;
    state.players[1]!.heroHp = 1;
    for (const owner of state.players) {
      owner.board = [];
      owner.runes = [];
      owner.pentagrams = [];
    }
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
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("ligues et trophées autoritaires", () => {
  it("debits natural solo defeats once, keeps earned slots through demotion and clamps losses to zero", async () => {
    const { t, alice, deckId } = await fixture();
    await setTrophies(t, deckId, 200);
    await t.run(async (ctx) => {
      const { ownerId } = (await ctx.db.get(deckId))!;
      await ctx.db.insert("collection", {
        ownerId,
        variantId: "fox:common",
        level: 1,
        copies: 0,
      });
    });
    await alice.mutation(api.decks.save, {
      deckId,
      name: "Cinq gardiens",
      cardIds: [...DEFAULT_DECK, "fox:common"],
    });
    const gameId = await alice.mutation(api.games.createSolo, { deckId });
    await t.run(async (ctx) => {
      const { state } = (await ctx.db.get(gameId))!;
      state!.players[0]!.heroHp = 1;
      state!.activePlayer = 1;
      state!.turn = 2;
      await ctx.db.patch(gameId, { state });
    });
    await alice.mutation(api.games.soloTurn, { gameId, expectedTurn: 2 });
    expect(await alice.query(api.collection.league, {})).toMatchObject({
      trophies: 185,
      peakTrophies: 200,
      current: { label: "Fer IV" },
      deckCapacity: 5,
    });
    const result = await alice.query(api.games.get, { gameId });
    expect(result).toMatchObject({
      status: "finished",
      winner: 1,
      reward: null,
      trophyChange: {
        trophies: -15,
        previousTrophies: 200,
        trophiesTotal: 185,
        deckCapacity: 5,
        deckSlotsGained: 0,
      },
    });
    expect((await alice.query(api.decks.list, {}))[0]!.cardIds).toHaveLength(5);
    expect((await alice.query(api.chests.list, {})).chests).toHaveLength(0);
    expect((await alice.query(api.chests.list, {})).victoryChest.wins).toBe(0);
    await t.mutation(internal.games.soloTurnFallback, {
      gameId,
      expectedTurn: 2,
    });
    await expect(
      alice.mutation(api.games.surrender, { gameId }),
    ).rejects.toThrow("terminée");
    expect((await alice.query(api.collection.league, {})).trophies).toBe(185);
    const recovered = await winSolo(t, alice, deckId);
    expect(
      (await alice.query(api.games.get, { gameId: recovered })).trophyChange,
    ).toMatchObject({
      trophies: 25,
      trophiesTotal: 210,
      deckCapacity: 5,
      deckSlotsGained: 0,
    });
    await setTrophies(t, deckId, 7);
    const surrender = await alice.mutation(api.games.createSolo, { deckId });
    await alice.mutation(api.games.surrender, { gameId: surrender });
    expect(
      (await alice.query(api.games.get, { gameId: surrender })).trophyChange,
    ).toMatchObject({ trophies: -7, trophiesTotal: 0 });
    const atZero = await alice.mutation(api.games.createSolo, { deckId });
    await alice.mutation(api.games.surrender, { gameId: atZero });
    expect(
      (await alice.query(api.games.get, { gameId: atZero })).trophyChange,
    ).toMatchObject({ trophies: 0, trophiesTotal: 0 });
    const progress = await t.run((ctx) =>
      ctx.db.query("leagueProgress").collect(),
    );
    expect(progress).toHaveLength(1);
    expect(progress[0]!.peakTrophies).toBe(210);
  });

  it("settles both public players atomically, exposes only personal trophy changes, and ignores friendly matches", async () => {
    const { t, alice, deckId } = await fixture();
    const bob = await player(t, "bob");
    const bobDeck = await bob.mutation(api.decks.ensureStarter, {});
    await setTrophies(t, deckId, 175);
    await setTrophies(t, bobDeck, 205);
    const room = await alice.mutation(api.games.createPrivate, { deckId });
    await bob.mutation(api.games.joinPrivate, {
      code: room.code,
      deckId: bobDeck,
    });
    await bob.mutation(api.games.surrender, { gameId: room.gameId });
    expect((await alice.query(api.collection.league, {})).trophies).toBe(175);
    expect((await bob.query(api.collection.league, {})).trophies).toBe(205);
    expect(
      (await bob.query(api.games.get, { gameId: room.gameId })).trophyChange,
    ).toBeNull();
    await alice.mutation(api.matchmaking.enqueue, { deckId });
    const match = await bob.mutation(api.matchmaking.enqueue, {
      deckId: bobDeck,
    });
    const attempts = await Promise.allSettled([
      bob.mutation(api.games.surrender, { gameId: match.gameId! }),
      bob.mutation(api.games.surrender, { gameId: match.gameId! }),
    ]);
    expect(
      attempts.filter((attempt) => attempt.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      (await alice.query(api.games.get, { gameId: match.gameId! }))
        .trophyChange,
    ).toMatchObject({ trophies: 25, trophiesTotal: 200 });
    expect(
      (await bob.query(api.games.get, { gameId: match.gameId! })).trophyChange,
    ).toMatchObject({ trophies: -15, trophiesTotal: 190 });
    expect(await bob.query(api.collection.league, {})).toMatchObject({
      trophies: 190,
      peakTrophies: 205,
      deckCapacity: 5,
      current: { label: "Fer IV" },
    });
    expect((await alice.query(api.chests.list, {})).chests).toHaveLength(1);
    expect((await bob.query(api.chests.list, {})).chests).toHaveLength(0);
  });

  it("promotes after eight wins even with full chest slots, rewards once, and enforces the new deck capacity", async () => {
    const { t, alice, deckId } = await fixture();
    await expect(t.query(api.collection.league, {})).rejects.toThrow(
      "Connecte-toi",
    );
    expect(await alice.query(api.collection.league, {})).toMatchObject({
      trophies: 0,
      current: { label: "Fer IV" },
      deckCapacity: 4,
    });
    await t.run(async (ctx) => {
      const { ownerId } = (await ctx.db.get(deckId))!;
      for (const variantId of ["fox:rare", "guardian:rare"])
        await ctx.db.insert("collection", {
          ownerId,
          variantId,
          level: 1,
          copies: 0,
        });
    });
    const save = (cardIds: string[]) =>
      alice.mutation(api.decks.save, { deckId, name: "Les gardiens", cardIds });
    const five = [...DEFAULT_DECK, "fox:rare"];
    await expect(save(five)).rejects.toThrow("autorise 4 cartes");
    let gameId: Id<"games"> | undefined;
    for (let i = 1; i <= 8; i++) {
      gameId = await winSolo(t, alice, deckId);
      expect(
        (await alice.query(api.games.get, { gameId })).reward,
      ).toMatchObject({
        trophies: 25,
        trophiesTotal: i * 25,
        previousTrophies: (i - 1) * 25,
      });
      if (i === 7)
        expect(
          (await alice.query(api.collection.league, {})).current.label,
        ).toBe("Fer IV");
    }
    expect(await alice.query(api.collection.league, {})).toMatchObject({
      trophies: 200,
      current: { label: "Fer III" },
      deckCapacity: 5,
    });
    expect((await alice.query(api.chests.list, {})).chests).toHaveLength(2);
    expect(
      (await alice.query(api.games.get, { gameId: gameId! })).reward!.status,
    ).toBe("lost");
    await expect(
      alice.mutation(api.games.playCard, {
        gameId: gameId!,
        cardId: DEFAULT_DECK[0]!,
        row: 0,
        depth: 0,
        expectedTurn: 1,
      }),
    ).rejects.toThrow();
    await t.mutation(internal.games.expireTurn, {
      gameId: gameId!,
      expectedTurn: 1,
    });
    expect((await alice.query(api.collection.league, {})).trophies).toBe(200);
    await save(five);
    await expect(save([...five, "guardian:rare"])).rejects.toThrow(
      "autorise 5 cartes",
    );
    const next = await alice.mutation(api.games.createSolo, { deckId });
    expect(
      (await alice.query(api.games.get, { gameId: next })).players[0]!.deck,
    ).toHaveLength(5);
    expect(
      (await alice.query(api.games.get, { gameId: gameId! })).players[0]!.deck,
    ).toHaveLength(4);
    const bob = await player(t, "bob");
    expect((await bob.query(api.collection.league, {})).trophies).toBe(0);
  });

  it("limits legacy decks in queries and match snapshots without deleting cards or changing records", async () => {
    const { t, alice, deckId } = await fixture();
    const ids = [
      ...DEFAULT_DECK,
      "fox:common",
      "owl:common",
      "dragon:common",
      "wolf:common",
    ];
    await t.run(async (ctx) => {
      const { ownerId } = (await ctx.db.get(deckId))!;
      for (const variantId of ids.slice(4))
        await ctx.db.insert("collection", {
          ownerId,
          variantId,
          level: 1,
          copies: 0,
        });
      await ctx.db.patch(deckId, { cardIds: ids });
    });
    expect((await alice.query(api.decks.list, {}))[0]!.cardIds).toEqual(
      DEFAULT_DECK,
    );
    const gameId = await alice.mutation(api.games.createSolo, { deckId });
    expect(
      (await alice.query(api.games.get, { gameId })).players[0]!.deck,
    ).toHaveLength(4);
    expect((await t.run((ctx) => ctx.db.get(deckId)))!.cardIds).toEqual(ids);
    expect(await alice.query(api.collection.list, {})).toHaveLength(8);
    await expect(
      alice.mutation(api.decks.save, {
        deckId,
        name: "Ancien deck",
        cardIds: ids,
      }),
    ).rejects.toThrow("autorise 4 cartes");
  });

  it("uses the newly reached league for loot and freezes sealed rewards across subsequent promotions", async () => {
    const { t, alice, deckId } = await fixture();
    vi.spyOn(Math, "random").mockReturnValue(0);
    await setTrophies(t, deckId, 775);
    const first = await winSolo(t, alice, deckId);
    const chest = await t.run(
      async (ctx) =>
        (await ctx.db.query("chests").collect()).find(
          (entry) => entry.gameId === first,
        )!,
    );
    expect(chest).toMatchObject({
      rarity: "common",
      contents: [{ variantId: "guardian:common", count: 9 }],
      gold: 48,
    });
    await setTrophies(t, deckId, 2400);
    await winSolo(t, alice, deckId);
    await winSolo(t, alice, deckId);
    const recurring = await alice.mutation(api.chests.openVictory, {
      cycle: 0,
    });
    expect(recurring).toMatchObject({
      gold: 64,
      reveals: [{ variantId: "guardian:common", count: 12 }],
    });
    vi.setSystemTime(chest.unlockAt);
    const opened = await alice.mutation(api.chests.open, {
      chestId: chest._id,
    });
    expect(opened).toMatchObject({
      gold: 48,
      reveals: [{ variantId: "guardian:common", count: 9 }],
    });
    expect(
      await alice.mutation(api.chests.open, { chestId: chest._id }),
    ).toEqual(opened);
    expect((await alice.query(api.collection.league, {})).trophies).toBe(2450);
  });
});

describe("gardien adapté aux ligues", () => {
  it("caps a strong player's bot at the current league and keeps that snapshot during a match", async () => {
    const { t, alice, deckId } = await fixture();
    await setTrophies(t, deckId, 2400);
    await t.run(async (ctx) => {
      const { ownerId } = (await ctx.db.get(deckId))!;
      const ids = CATALOG.slice(0, 8).map((card) => `${card.id}:legendary`);
      for (const variantId of ids)
        await ctx.db.insert("collection", {
          ownerId,
          variantId,
          level: 10,
          copies: 0,
        });
      await ctx.db.patch(deckId, { cardIds: ids });
    });
    const gameId = await alice.mutation(api.games.createSolo, { deckId });
    const snapshot = await alice.query(api.games.get, { gameId });
    expect(snapshot.players[1]!.deck).toHaveLength(8);
    expect(
      snapshot.players[1]!.deck.every(
        (card) => card.rarity === "rare" && card.level === 10,
      ),
    ).toBe(true);
    expect(
      new Set(snapshot.players[1]!.deck.map((card) => card.baseId)).size,
    ).toBe(8);
    await setTrophies(t, deckId, 6000);
    expect(
      (await alice.query(api.games.get, { gameId })).players[1]!.deck,
    ).toEqual(snapshot.players[1]!.deck);
  });

  it("remembers recent creatures across normal and scheduled turns without counting retried turns twice", async () => {
    const { t, alice, deckId } = await fixture();
    const gameId = await alice.mutation(api.games.createSolo, { deckId });
    await t.run(async (ctx) => {
      const { state } = (await ctx.db.get(gameId))!;
      state!.players[0]!.heroHp = 1000;
      await ctx.db.patch(gameId, { state });
    });
    let previous: string | undefined;
    for (let i = 0; i < 5; i++) {
      const human = await alice.query(api.games.get, { gameId });
      await alice.mutation(api.games.endTurn, {
        gameId,
        expectedTurn: human.turn,
      });
      const expectedTurn = human.turn + 1;
      if (i % 2)
        await t.mutation(internal.games.soloTurnFallback, {
          gameId,
          expectedTurn,
        });
      else await alice.mutation(api.games.soloTurn, { gameId, expectedTurn });
      const game = await t.run((ctx) => ctx.db.get(gameId));
      const history = game!.soloRecentCards!;
      expect(history).toHaveLength(Math.min(3, i + 1));
      expect(history[history.length - 1]).not.toBe(previous);
      previous = history[history.length - 1];
      await alice.mutation(api.games.soloTurn, { gameId, expectedTurn });
      expect(
        (await t.run((ctx) => ctx.db.get(gameId)))!.soloRecentCards,
      ).toEqual(history);
    }
  });
});

describe("collection autoritaire", () => {
  it("upgrades past the old level ten cap and persists the newly unlocked ability", async () => {
    const { t, alice, deckId } = await fixture();
    await t.run(async (ctx) => {
      const deck = (await ctx.db.get(deckId))!;
      const owned = (await ctx.db
        .query("collection")
        .withIndex("by_owner_variant", (q) =>
          q.eq("ownerId", deck.ownerId).eq("variantId", "guardian:common"),
        )
        .unique())!;
      await ctx.db.patch(owned._id, { level: 10, copies: 450 });
      await ctx.db.insert("wallets", { ownerId: deck.ownerId, gold: 3000 });
    });
    const result = await alice.mutation(api.collection.upgrade, {
      variantId: "guardian:common",
    });
    expect(result).toMatchObject({
      copies: 0,
      gold: 0,
      card: { level: 11, attack: 8, health: 16 },
    });
    expect(result.card.abilities?.[1]).toMatchObject({
      active: true,
      unlockLevel: 11,
      value: 1,
    });
    expect(
      (await alice.query(api.collection.list, {})).find(
        (e) => e.card.id === "guardian:common",
      )!.card.abilities,
    ).toEqual(result.card.abilities);
  });
  it.each(["rare", "epic", "legendary"] as const)(
    "upgrades %s cards to 31 and snapshots evolution metadata",
    async (rarity) => {
      const { t, alice, deckId } = await fixture();
      const variantId = `guardian:${rarity}`;
      const copies = upgradeCost(30, rarity);
      const gold = upgradeGoldCost(30, rarity);
      await t.run(async (ctx) => {
        const { ownerId } = (await ctx.db.get(deckId))!;
        await ctx.db.insert("collection", {
          ownerId,
          variantId,
          level: 30,
          copies,
        });
        await ctx.db.insert("wallets", { ownerId, gold });
      });
      const upgraded = await alice.mutation(api.collection.upgrade, {
        variantId,
      });
      expect(upgraded).toMatchObject({
        copies: 0,
        gold: 0,
        card: resolveCard(variantId, 31),
      });
      await expect(
        alice.mutation(api.collection.upgrade, { variantId }),
      ).rejects.toThrow("maximal");
      await alice.mutation(api.decks.save, {
        deckId,
        name: "Évolutions",
        cardIds: [variantId, ...DEFAULT_DECK.slice(1)],
      });
      const gameId = await alice.mutation(api.games.createSolo, { deckId });
      const view = await alice.query(api.games.get, { gameId });
      expect(view.players[0]!.deck.find((c) => c.id === variantId)).toEqual(
        upgraded.card,
      );
    },
  );
  it.each(
    CATALOG.filter((c) => !["tree", "idol"].includes(c.id)).map((c) => c.id),
  )("persists the Legendary profile and live states of %s", async (baseId) => {
    const { t, alice, deckId } = await fixture();
    const variantId = `${baseId}:legendary`;
    await t.run(async (ctx) => {
      const { ownerId } = (await ctx.db.get(deckId))!;
      await ctx.db.insert("collection", {
        ownerId,
        variantId,
        level: 1,
        copies: 0,
      });
    });
    await alice.mutation(api.decks.save, {
      deckId,
      name: "Légendes",
      cardIds: [variantId, ...DEFAULT_DECK.slice(1)],
    });
    const gameId = await alice.mutation(api.games.createSolo, { deckId });
    const card = resolveCard(variantId);
    await t.run(async (ctx) => {
      const state = (await ctx.db.get(gameId))!.state!;
      for (const owner of state.players) {
        owner.board = [];
        owner.runes = [];
        owner.pentagrams = [];
      }
      await ctx.db.patch(gameId, { state });
    });
    await alice.mutation(api.games.playCard, {
      gameId,
      cardId: variantId,
      row: 0,
      depth: card.combatType === "ranged" ? 2 : 0,
      expectedTurn: 1,
    });
    const view = await alice.query(api.games.get, { gameId });
    expect(view.players[0]!.deck.find((c) => c.id === variantId)).toEqual(card);
    const unit = view.players[0]!.board.find((u) => u.cardId === variantId)!;
    expect(unit).toBeTruthy();
    if (baseId === "stag") expect(unit.immune).toBe(true);
    if (baseId === "captain") expect(unit.evasion).toBe(true);
    if (baseId === "lynx") expect(unit.counterAttack).toBe(true);
  });
  it("persists increases to hero maximum health and their combat events", async () => {
    const { t, alice, deckId } = await fixture();
    await t.run(async (ctx) => {
      const { ownerId } = (await ctx.db.get(deckId))!;
      await ctx.db.insert("collection", {
        ownerId,
        variantId: "dragon:legendary",
        level: 1,
        copies: 0,
      });
    });
    await alice.mutation(api.decks.save, {
      deckId,
      name: "Aube",
      cardIds: [
        "dragon:legendary",
        "guardian:common",
        "turtle:common",
        "wisp:common",
      ],
    });
    const gameId = await alice.mutation(api.games.createSolo, { deckId });
    await t.run(async (ctx) => {
      const state = (await ctx.db.get(gameId))!.state!;
      for (const owner of state.players) {
        owner.board = [];
        owner.runes = [];
        owner.pentagrams = [];
      }
      state.players[1]!.heroHp = 100;
      state.players[1]!.heroMaxHp = 100;
      state.players[0]!.board.push({
        cardId: "guardian:common",
        row: 1,
        depth: 0,
        hp: 8,
      });
      state.players[1]!.board.push({
        cardId: "guardian:common",
        row: 1,
        depth: 0,
        hp: 1,
      });
      await ctx.db.patch(gameId, { state });
    });
    await alice.mutation(api.games.playCard, {
      gameId,
      cardId: "dragon:legendary",
      row: 3,
      depth: 2,
      expectedTurn: 1,
    });
    const view = await alice.query(api.games.get, { gameId });
    expect(view.players[0]).toMatchObject({ heroHp: 39, heroMaxHp: 39 });
  });
  it("persists poison granted by an Epic end-of-turn skill", async () => {
    const { t, alice, deckId } = await fixture();
    await t.run(async (ctx) => {
      const { ownerId } = (await ctx.db.get(deckId))!;
      await ctx.db.insert("collection", {
        ownerId,
        variantId: "mushroom:epic",
        level: 1,
        copies: 0,
      });
    });
    await alice.mutation(api.decks.save, {
      deckId,
      name: "Poison",
      cardIds: [
        "mushroom:epic",
        "guardian:common",
        "turtle:common",
        "wisp:common",
      ],
    });
    const gameId = await alice.mutation(api.games.createSolo, { deckId });
    await t.run(async (ctx) => {
      const state = (await ctx.db.get(gameId))!.state!;
      for (const owner of state.players) {
        owner.board = [];
        owner.runes = [];
        owner.pentagrams = [];
      }
      state.players[0]!.board.push({
        cardId: "guardian:common",
        row: 1,
        depth: 0,
        hp: 8,
      });
      await ctx.db.patch(gameId, { state });
    });
    await alice.mutation(api.games.playCard, {
      gameId,
      cardId: "mushroom:epic",
      row: 0,
      depth: 2,
      expectedTurn: 1,
    });
    const view = await alice.query(api.games.get, { gameId });
    expect(
      view.players[0]!.board.find((u) => u.cardId === "guardian:common")!
        .poison,
    ).toBe(3);
  });
  it("persists summoned tokens and their events without adding cards to the player's deck", async () => {
    const { t, alice, deckId } = await fixture();
    await t.run(async (ctx) => {
      const deck = (await ctx.db.get(deckId))!;
      await ctx.db.insert("collection", {
        ownerId: deck.ownerId,
        variantId: "witch:common",
        level: 1,
        copies: 0,
      });
      await ctx.db.patch(deckId, {
        cardIds: ["witch:common", ...DEFAULT_DECK.slice(1)],
      });
    });
    const gameId = await alice.mutation(api.games.createSolo, { deckId });
    // Isolate reinforcement persistence from the randomized initial terrain.
    await t.run(async (ctx) => {
      const game = (await ctx.db.get(gameId))!;
      const state = game.state!;
      for (const owner of state.players) {
        owner.board = [];
        owner.runes = [];
        owner.pentagrams = [];
      }
      await ctx.db.patch(gameId, { state });
    });
    const before = await alice.query(api.games.get, { gameId });
    await alice.mutation(api.games.playCard, {
      gameId,
      cardId: "witch:common",
      row: 0,
      depth: 2,
      expectedTurn: before.turn,
    });
    const view = await alice.query(api.games.get, { gameId });
    expect(view.players[0]!.deck).toHaveLength(4);
    expect(view.players[0]!.board.filter((unit) => !unit.fieldObject)).toHaveLength(2);
    expect(
      view.players[0]!.board.find((u) => u.definition && !u.fieldObject)?.card,
    ).toMatchObject({ name: "Rejeton des spores", attack: 2, health: 2 });
    expect(view.events.filter((e) => e.type === "summon")).toHaveLength(2);
    expect(
      (await alice.query(api.collection.list, {})).some(
        (e) => e.card.kind === "zombie",
      ),
    ).toBe(false);
    await t.run(async (ctx) => {
      const game = (await ctx.db.get(gameId))!;
      const state = game.state!;
      state.players[1]!.cards = state.players[0]!.cards;
      state.players[1]!.hand = ["witch:common"];
      await ctx.db.patch(gameId, { state });
    });
    await alice.mutation(api.games.soloTurn, {
      gameId,
      expectedTurn: view.turn,
    });
    const stored = (await t.run((ctx) => ctx.db.get(gameId)))!;
    expect(stored.state!.players[1]!.board.some((u) => u.definition?.kind === "zombie")).toBe(
      true,
    );
    expect(stored.soloRecentCards).toEqual(["witch:common"]);
  });
  it("initializes exactly four common variants once", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    await expect(t.query(api.collection.list, {})).rejects.toThrow(
      "Connecte-toi",
    );
    await expect(t.query(api.collection.gold, {})).rejects.toThrow(
      "Connecte-toi",
    );
    expect(await alice.query(api.collection.gold, {})).toBe(0);
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
      await ctx.db.patch(entry._id, { copies: 25 });
      await ctx.db.insert("wallets", { ownerId: deck.ownerId, gold: 50 });
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
    expect(await alice.query(api.collection.gold, {})).toBe(0);
  });
  it("rejects an upgrade without gold without consuming copies, and shares gold across variants", async () => {
    const { t, alice, deckId } = await fixture();
    const bob = await player(t, "bob");
    await t.run(async (ctx) => {
      const deck = (await ctx.db.get(deckId))!;
      const entries = await ctx.db
        .query("collection")
        .withIndex("by_owner_variant", (q) => q.eq("ownerId", deck.ownerId))
        .collect();
      for (const entry of entries)
        await ctx.db.patch(entry._id, { copies: 40 });
    });
    const original = await alice.query(api.collection.list, {});
    await expect(
      alice.mutation(api.collection.upgrade, { variantId: DEFAULT_DECK[0]! }),
    ).rejects.toThrow("pièces d’or");
    expect(await alice.query(api.collection.list, {})).toEqual(original);
    await t.run(async (ctx) => {
      const deck = (await ctx.db.get(deckId))!;
      await ctx.db.insert("wallets", { ownerId: deck.ownerId, gold: 50 });
    });
    const results = await Promise.allSettled(
      DEFAULT_DECK.slice(0, 2).map((variantId) =>
        alice.mutation(api.collection.upgrade, { variantId }),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(await alice.query(api.collection.gold, {})).toBe(0);
    expect(await bob.query(api.collection.gold, {})).toBe(0);
    const upgraded = await alice.query(api.collection.list, {});
    expect(upgraded.filter((entry) => entry.card.level === 2)).toHaveLength(1);
    expect(upgraded.reduce((sum, entry) => sum + entry.copies, 0)).toBe(135);
  });
  it("rejects unowned variants, another player's cards, insufficient copies and levels past 26", async () => {
    const { t, alice, deckId } = await fixture();
    const bob = await player(t, "bob");
    await expect(
      alice.mutation(api.decks.save, {
        deckId,
        name: "Deck",
        cardIds: [...DEFAULT_DECK.slice(0, 3), "fox:legendary"],
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
    expect(chest).not.toHaveProperty("gold");
    expect(await alice.query(api.collection.gold, {})).toBe(0);
    const unlockAt = Date.now() + 15 * 60_000;
    await t.run((ctx) =>
      ctx.db.patch(chest._id, {
        rarity: "rare",
        unlockAt,
        contents: [{ variantId: "fox:rare", count: 40 }],
        gold: 150,
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
    ).toEqual(["fox:rare"]);
    expect(results[0]!.reveals).toHaveLength(1);
    expect(results[0]!.gold).toBe(150);
    expect(await alice.query(api.collection.gold, {})).toBe(150);
    expect(await bob.query(api.collection.gold, {})).toBe(0);
    expect((await alice.query(api.chests.list, {})).chests).toHaveLength(0);
    let entries = await alice.query(api.collection.list, {});
    expect(
      entries.find((entry) => entry.card.id === "guardian:common")!.copies,
    ).toBe(0);
    expect(entries.find((entry) => entry.card.id === "fox:rare")!.copies).toBe(
      39,
    );
    await alice.mutation(api.collection.upgrade, {
      variantId: "fox:rare",
    });
    entries = await alice.query(api.collection.list, {});
    expect(entries.find((entry) => entry.card.id === "fox:rare")).toMatchObject(
      {
        copies: 14,
        card: { level: 2, rarity: "rare" },
      },
    );
    expect(
      entries.find((entry) => entry.card.id === "guardian:common")!.card.level,
    ).toBe(1);
    await alice.mutation(api.chests.open, { chestId: chest._id });
    expect(
      (await alice.query(api.collection.list, {})).find(
        (entry) => entry.card.id === "guardian:common",
      )!.copies,
    ).toBe(0);
    expect(await alice.query(api.collection.gold, {})).toBe(50);
    await setTrophies(t, deckId, 200);
    await alice.mutation(api.decks.save, {
      deckId,
      name: "Les variantes",
      cardIds: [...DEFAULT_DECK, "fox:rare"],
    });
    const nextId = await alice.mutation(api.games.createSolo, { deckId });
    const next = await alice.query(api.games.get, { gameId: nextId });
    expect(next.players[0]!.deck).toHaveLength(5);
    expect(
      next.players[0]!.deck.find((card) => card.id === "fox:rare")!.level,
    ).toBe(2);
    expect(
      original.players[0]!.deck.find((card) => card.id === "guardian:common")!
        .attack,
    ).toBe(3);
    expect(
      next.players[1]!.deck.map(
        (card) => `${card.rarity}:${card.level}`,
      ).sort(),
    ).toEqual(Array(5).fill("common:1"));
  });
  it("runs two parallel timers, loses the third combat chest even if chests are ready and reuses a released slot", async () => {
    const { t, alice, deckId } = await fixture();
    for (let i = 0; i < CHEST_SLOTS; i++) await winSolo(t, alice, deckId);
    const inventory = await alice.query(api.chests.list, {});
    expect(inventory.chests.map((chest) => chest.slot).sort()).toEqual([0, 1]);
    const stored = await t.run((ctx) => ctx.db.query("chests").collect());
    expect(new Set(stored.map((chest) => chest.awardedAt)).size).toBe(1);
    for (const chest of stored) {
      expect(chest.unlockAt - chest.awardedAt).toBe(
        CHEST_RULES[chest.rarity].durationMs,
      );
      expect(chest.contents).toHaveLength(1);
      expect(resolveCard(chest.contents[0]!.variantId).rarity).toBe(
        chest.rarity,
      );
      expect(chest.contents[0]!.count).toBeGreaterThanOrEqual(
        CHEST_RULES[chest.rarity].min,
      );
      expect(chest.contents[0]!.count).toBeLessThanOrEqual(
        CHEST_RULES[chest.rarity].max,
      );
      expect(chest.gold).toBeGreaterThanOrEqual(
        CHEST_RULES[chest.rarity].minGold,
      );
      expect(chest.gold).toBeLessThanOrEqual(CHEST_RULES[chest.rarity].maxGold);
    }
    expect(await alice.query(api.collection.gold, {})).toBe(0);
    vi.setSystemTime(Date.now() + 8 * 3_600_000);
    const lostGame = await winSolo(t, alice, deckId);
    expect(
      (await alice.query(api.games.get, { gameId: lostGame })).reward?.status,
    ).toBe("lost");
    expect((await alice.query(api.chests.list, {})).chests).toHaveLength(
      CHEST_SLOTS,
    );
    await expect(
      alice.mutation(api.games.surrender, { gameId: lostGame }),
    ).rejects.toThrow("terminée");
    const opened = await alice.mutation(api.chests.open, {
      chestId: inventory.chests[0]!._id,
    });
    const frozen = stored.find(
      (chest) => chest._id === inventory.chests[0]!._id,
    )!;
    expect(opened.gold).toBe(frozen.gold);
    expect(
      opened.reveals.map(({ variantId, count }) => ({ variantId, count })),
    ).toEqual(frozen.contents);
    expect(await alice.query(api.collection.gold, {})).toBe(frozen.gold);
    await winSolo(t, alice, deckId);
    const next = (await alice.query(api.chests.list, {})).chests;
    expect(next).toHaveLength(CHEST_SLOTS);
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
    expect((await alice.query(api.collection.league, {})).trophies).toBe(0);
    await alice.mutation(api.matchmaking.enqueue, { deckId });
    const matched = await bob.mutation(api.matchmaking.enqueue, {
      deckId: bobDeck,
    });
    await bob.mutation(api.games.surrender, { gameId: matched.gameId! });
    expect((await alice.query(api.chests.list, {})).chests).toHaveLength(1);
    expect((await bob.query(api.chests.list, {})).chests).toHaveLength(0);
    expect((await alice.query(api.collection.league, {})).trophies).toBe(25);
    expect((await bob.query(api.collection.league, {})).trophies).toBe(0);
    expect(
      (await bob.query(api.games.get, { gameId: matched.gameId! })).reward,
    ).toBeNull();
    const solo = await alice.mutation(api.games.createSolo, { deckId });
    await alice.mutation(api.games.surrender, { gameId: solo });
    expect((await alice.query(api.chests.list, {})).chests).toHaveLength(1);
    expect((await alice.query(api.collection.league, {})).trophies).toBe(10);
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
      await ctx.db.patch(owned._id, { copies: 25 });
      await ctx.db.insert("wallets", { ownerId: deck.ownerId, gold: 50 });
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

describe("anciens coffres", () => {
  it.each(RARITIES)(
    "converts an unopened legacy %s chest once to gold and one matching card",
    async (rarity) => {
      const { t, alice, deckId } = await fixture();
      const gameId = await winSolo(t, alice, deckId);
      const chestId = await t.run(async (ctx) => {
        const deck = (await ctx.db.get(deckId))!;
        return ctx.db.insert("chests", {
          ownerId: deck.ownerId,
          gameId,
          slot: 1,
          rarity,
          status: "unopened",
          awardedAt: 0,
          unlockAt: 0,
          contents: [
            { variantId: "guardian:common", count: 2 },
            { variantId: "fox:rare", count: 3 },
          ],
        });
      });
      const claims = await Promise.all([
        alice.mutation(api.chests.open, { chestId }),
        alice.mutation(api.chests.open, { chestId }),
      ]);
      expect(claims[0]).toEqual(claims[1]);
      const reward = claims[0]!;
      expect(reward.reveals).toHaveLength(1);
      expect(resolveCard(reward.reveals[0]!.variantId).rarity).toBe(rarity);
      expect(reward.reveals[0]!.count).toBeGreaterThanOrEqual(
        CHEST_RULES[rarity].min,
      );
      expect(reward.gold).toBeGreaterThanOrEqual(CHEST_RULES[rarity].minGold);
      expect(reward.gold).toBeLessThanOrEqual(CHEST_RULES[rarity].maxGold);
      expect(await alice.query(api.collection.gold, {})).toBe(reward.gold);
      await alice.mutation(api.chests.open, { chestId });
      expect(await alice.query(api.collection.gold, {})).toBe(reward.gold);
    },
  );
  it("converts a ready legacy victory chest and leaves previously claimed rewards untouched", async () => {
    const { t, alice, deckId } = await fixture();
    await t.run(async (ctx) => {
      const deck = (await ctx.db.get(deckId))!;
      await ctx.db.insert("victoryChests", {
        ownerId: deck.ownerId,
        wins: 3,
        cycle: 1,
        contents: [{ variantId: "fox:rare", count: 2 }],
        lastClaim: { cycle: 0, reveals: [] },
      });
    });
    expect(
      await alice.mutation(api.chests.openVictory, { cycle: 0 }),
    ).toMatchObject({ gold: 0 });
    expect(await alice.query(api.collection.gold, {})).toBe(0);
    const reward = await alice.mutation(api.chests.openVictory, { cycle: 1 });
    expect(reward.reveals).toHaveLength(1);
    expect(resolveCard(reward.reveals[0]!.variantId).rarity).toBe("common");
    expect(reward.gold).toBeGreaterThanOrEqual(CHEST_RULES.common.minGold);
    expect(await alice.mutation(api.chests.openVictory, { cycle: 1 })).toEqual(
      reward,
    );
    expect(await alice.query(api.collection.gold, {})).toBe(reward.gold);
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
    const cell = legalPlacements(card, view.players[0]!.board)[0]!;
    await alice.mutation(api.games.playCard, {
      gameId,
      cardId: card.id,
      ...cell,
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
    const cell = legalPlacements(card, view.players[0]!.board)[0]!;
    await alice.mutation(api.games.playCard, {
      gameId,
      cardId: card.id,
      ...cell,
      expectedTurn: 1,
    });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const restored = await alice.query(api.games.get, { gameId });
    expect(restored.turn).toBe(3);
    expect(restored.activePlayer).toBe(0);
    expect(restored.players[1]!.board.filter((unit) => !unit.fieldObject)).toHaveLength(1);
  });
});

describe("coffre commun de trois victoires", () => {
  it("counts solo wins through full slots, claims once and restarts successive cycles", async () => {
    const { t, alice, deckId } = await fixture();
    const bob = await player(t, "bob");
    expect((await alice.query(api.chests.list, {})).victoryChest).toEqual({
      wins: 0,
      requiredWins: 3,
      cycle: 0,
    });
    await expect(
      alice.mutation(api.chests.openVictory, { cycle: 0 }),
    ).rejects.toThrow("trois victoires");
    let lastGame: Id<"games"> | undefined;
    for (let wins = 1; wins <= 3; wins++) {
      lastGame = await winSolo(t, alice, deckId);
      const inventory = await alice.query(api.chests.list, {});
      expect(inventory.victoryChest).toEqual({
        wins,
        requiredWins: 3,
        cycle: 0,
      });
      expect(inventory.victoryChest).not.toHaveProperty("contents");
      expect(
        (await alice.query(api.games.get, { gameId: lastGame })).reward
          ?.victoryWins,
      ).toBe(wins);
      if (wins < 3)
        await expect(
          alice.mutation(api.chests.openVictory, { cycle: 0 }),
        ).rejects.toThrow("trois victoires");
    }
    expect(
      (await alice.query(api.games.get, { gameId: lastGame! })).reward?.status,
    ).toBe("lost");
    expect((await alice.query(api.chests.list, {})).chests).toHaveLength(2);
    await expect(
      alice.mutation(api.games.surrender, { gameId: lastGame! }),
    ).rejects.toThrow("terminée");
    await expect(
      bob.mutation(api.chests.openVictory, { cycle: 0 }),
    ).rejects.toThrow("trois victoires");
    const row = (
      await t.run((ctx) => ctx.db.query("victoryChests").collect())
    )[0]!;
    const frozenContents = row.contents;
    const frozenGold = row.gold;
    expect(frozenContents).toHaveLength(1);
    expect(resolveCard(frozenContents[0]!.variantId).rarity).toBe("common");
    await winSolo(t, alice, deckId);
    expect((await alice.query(api.chests.list, {})).victoryChest.wins).toBe(3);
    expect((await t.run((ctx) => ctx.db.get(row._id)))!.contents).toEqual(
      frozenContents,
    );
    expect((await t.run((ctx) => ctx.db.get(row._id)))!.gold).toBe(frozenGold);
    await t.run((ctx) =>
      ctx.db.patch(row._id, {
        contents: [{ variantId: "fox:common", count: 12 }],
        gold: 60,
      }),
    );
    const claims = await Promise.all([
      alice.mutation(api.chests.openVictory, { cycle: 0 }),
      alice.mutation(api.chests.openVictory, { cycle: 0 }),
    ]);
    expect(claims[0]).toEqual(claims[1]);
    expect(claims[0]!.rarity).toBe("common");
    expect(claims[0]!.reveals).toHaveLength(1);
    expect(claims[0]!.gold).toBe(60);
    expect(await alice.query(api.collection.gold, {})).toBe(60);
    expect(
      claims[0]!.reveals.find((item) => item.variantId === "fox:common"),
    ).toMatchObject({ isNew: true, copies: 11 });
    const owned = await alice.query(api.collection.list, {});
    expect(
      owned.find((entry) => entry.card.id === "guardian:common")!.copies,
    ).toBe(0);
    expect((await alice.query(api.chests.list, {})).victoryChest).toEqual({
      wins: 0,
      requiredWins: 3,
      cycle: 1,
    });
    expect((await alice.query(api.chests.list, {})).chests).toHaveLength(2);
    await winSolo(t, alice, deckId);
    await alice.mutation(api.chests.openVictory, { cycle: 0 });
    expect(await alice.query(api.collection.list, {})).toEqual(owned);
    expect(await alice.query(api.collection.gold, {})).toBe(60);
    expect((await alice.query(api.chests.list, {})).victoryChest.wins).toBe(1);
    await winSolo(t, alice, deckId);
    await winSolo(t, alice, deckId);
    const secondClaim = await alice.mutation(api.chests.openVictory, {
      cycle: 1,
    });
    expect(secondClaim.reveals).toHaveLength(1);
    expect(await alice.query(api.collection.gold, {})).toBe(
      60 + secondClaim.gold,
    );
    expect((await alice.query(api.chests.list, {})).victoryChest).toEqual({
      wins: 0,
      requiredWins: 3,
      cycle: 2,
    });
    await expect(
      alice.mutation(api.chests.openVictory, { cycle: 0 }),
    ).rejects.toThrow("trois victoires");
  });
  it("ignores friendly victories and defeats but counts public victories", async () => {
    const { t, alice, deckId } = await fixture();
    const bob = await player(t, "bob");
    const bobDeck = await bob.mutation(api.decks.ensureStarter, {});
    const room = await alice.mutation(api.games.createPrivate, { deckId });
    await bob.mutation(api.games.joinPrivate, {
      code: room.code,
      deckId: bobDeck,
    });
    await bob.mutation(api.games.surrender, { gameId: room.gameId });
    expect((await alice.query(api.chests.list, {})).victoryChest.wins).toBe(0);
    await alice.mutation(api.matchmaking.enqueue, { deckId });
    const matched = await bob.mutation(api.matchmaking.enqueue, {
      deckId: bobDeck,
    });
    await bob.mutation(api.games.surrender, { gameId: matched.gameId! });
    expect((await alice.query(api.chests.list, {})).victoryChest.wins).toBe(1);
    expect((await bob.query(api.chests.list, {})).victoryChest.wins).toBe(0);
    const solo = await alice.mutation(api.games.createSolo, { deckId });
    await alice.mutation(api.games.surrender, { gameId: solo });
    expect((await alice.query(api.chests.list, {})).victoryChest.wins).toBe(1);
  });
  it("keeps existing chests accessible when legacy slots exceed the new capacity", async () => {
    const { t, alice, deckId } = await fixture();
    await winSolo(t, alice, deckId);
    await t.run(async (ctx) => {
      const old = (await ctx.db.query("chests").collect())[0]!;
      await ctx.db.patch(old._id, { slot: 3, unlockAt: 0 });
      const values = {
        ownerId: old.ownerId,
        gameId: old.gameId,
        rarity: old.rarity,
        status: "unopened" as const,
        awardedAt: old.awardedAt,
        unlockAt: 0,
        contents: old.contents,
      };
      await ctx.db.insert("chests", { ...values, slot: 2 });
      await ctx.db.insert("chests", { ...values, slot: 1 });
    });
    const legacy = await alice.query(api.chests.list, {});
    expect(legacy.chests.map((chest) => chest.slot)).toEqual([0, 1, 2]);
    await winSolo(t, alice, deckId);
    expect((await alice.query(api.chests.list, {})).chests).toHaveLength(3);
    await alice.mutation(api.chests.open, { chestId: legacy.chests[0]!._id });
    expect(
      (await alice.query(api.chests.list, {})).chests.map(
        (chest) => chest.slot,
      ),
    ).toEqual([0, 1]);
  });
});
