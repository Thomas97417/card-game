import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CATALOG,
  DEFAULT_DECK,
  getCombatType,
  validateDeck,
} from "@sylve/game";
import { api, components, internal } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
function setup() {
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
  return t;
}
type Test = ReturnType<typeof setup>;
async function player(t: Test, name: string) {
  const now = Date.now();
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "user",
      data: {
        name,
        email: `${name}@example.invalid`,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    },
  });
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "session",
      data: {
        userId: user._id,
        token: `${name}-session`,
        createdAt: now,
        updatedAt: now,
        expiresAt: now + 3_600_000,
      },
    },
  });
  return t.withIdentity({ subject: user._id, sessionId: session._id });
}
async function match() {
  const t = setup();
  const alice = await player(t, "alice");
  const bob = await player(t, "bob");
  const aDeck = await alice.mutation(api.decks.ensureStarter, {});
  const bDeck = await bob.mutation(api.decks.ensureStarter, {});
  const invitation = await alice.mutation(api.games.createPrivate, {
    deckId: aDeck,
  });
  await bob.mutation(api.games.joinPrivate, {
    code: invitation.code,
    deckId: bDeck,
  });
  return { t, alice, bob, aDeck, bDeck, gameId: invitation.gameId };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
describe("decks et authentification", () => {
  it("requires authentication and creates one starter despite repeated requests", async () => {
    const t = setup();
    await expect(t.query(api.decks.list, {})).rejects.toThrow("Connecte-toi");
    const alice = await player(t, "alice");
    const first = await alice.mutation(api.decks.ensureStarter, {});
    expect(await alice.mutation(api.decks.ensureStarter, {})).toBe(first);
    expect(await alice.query(api.decks.list, {})).toHaveLength(1);
  });
  it("uses the latest deck, preserving other decks and the active card order after initialization", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const first = await alice.mutation(api.decks.ensureStarter, {});
    const oldIds = [...DEFAULT_DECK];
    const second = await t.run(async (ctx) => {
      const original = (await ctx.db.get(first))!;
      await ctx.db.patch(first, {
        cardIds: oldIds,
        updatedAt: Date.now() - 1000,
      });
      return await ctx.db.insert("decks", {
        ownerId: original.ownerId,
        name: "Second",
        cardIds: [...oldIds].reverse(),
        updatedAt: Date.now(),
      });
    });
    expect(await alice.mutation(api.decks.ensureStarter, {})).toBe(second);
    const decks = await alice.query(api.decks.list, {});
    expect(decks).toHaveLength(1);
    expect(decks[0]!._id).toBe(second);
    expect(decks[0]!.cardIds).toEqual([...oldIds].reverse().slice(0, 8));
    expect((await t.run((ctx) => ctx.db.get(first)))!.cardIds).toEqual(oldIds);
    await expect(
      alice.mutation(api.decks.save, {
        deckId: first,
        name: "Ancien",
        cardIds: [...DEFAULT_DECK],
      }),
    ).rejects.toThrow("appartient");
    await expect(
      alice.mutation(api.games.createPrivate, { deckId: first }),
    ).rejects.toThrow("appartient");
  });
  it("rejects creating another deck or deleting the unique deck", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const id = await alice.mutation(api.decks.ensureStarter, {});
    await expect(
      alice.mutation(api.decks.save, {
        name: "Un autre deck",
        cardIds: [...DEFAULT_DECK],
      }),
    ).rejects.toThrow("un seul deck");
    await expect(
      alice.mutation(api.decks.remove, { deckId: id }),
    ).rejects.toThrow("unique");
    const ids = await Promise.all(
      Array.from({ length: 4 }, () =>
        alice.mutation(api.decks.ensureStarter, {}),
      ),
    );
    expect(new Set(ids)).toEqual(new Set([id]));
    expect(await alice.query(api.decks.list, {})).toHaveLength(1);
  });
  it("rejects duplicates, wrong sizes, unknown cards and another player's deck", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const bob = await player(t, "bob");
    const id = await alice.mutation(api.decks.ensureStarter, {});
    for (const ids of [
      DEFAULT_DECK.slice(1),
      CATALOG.slice(0, 10).map((card) => card.id),
      [...DEFAULT_DECK.slice(1), DEFAULT_DECK[1]!],
      [...DEFAULT_DECK.slice(1), "missing"],
    ])
      await expect(
        alice.mutation(api.decks.save, {
          deckId: id,
          name: "Test",
          cardIds: ids,
        }),
      ).rejects.toThrow();
    await expect(
      bob.mutation(api.decks.save, {
        deckId: id,
        name: "Stolen",
        cardIds: [...DEFAULT_DECK],
      }),
    ).rejects.toThrow("appartient");
    await expect(
      bob.mutation(api.decks.remove, { deckId: id }),
    ).rejects.toThrow("appartient");
    await expect(
      bob.mutation(api.games.createPrivate, { deckId: id }),
    ).rejects.toThrow("appartient");
  });
});
describe("invitations et synchronisation", () => {
  it("keeps invitation snapshots readable when their combat type is absent", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const bob = await player(t, "bob");
    const aDeck = await alice.mutation(api.decks.ensureStarter, {});
    const bDeck = await bob.mutation(api.decks.ensureStarter, {});
    const oldCards = validateDeck(DEFAULT_DECK).map(
      ({ combatType, ...card }) => card,
    );
    const room = await alice.mutation(api.games.createPrivate, {
      deckId: aDeck,
    });
    expect((await t.run((ctx) => ctx.db.get(aDeck)))!.cardIds).toHaveLength(4);
    // Model an invitation whose snapshot was saved before the rules changed.
    await t.run((ctx) => ctx.db.patch(room.gameId, { hostCards: oldCards }));
    await bob.mutation(api.games.joinPrivate, {
      code: room.code,
      deckId: bDeck,
    });
    const game = await t.run((ctx) => ctx.db.get(room.gameId));
    for (const owner of game!.state!.players) {
      expect(owner.cards).toHaveLength(4);
      expect(owner.hand).toHaveLength(4);
      expect(owner.drawPile).toHaveLength(0);
      expect(
        owner.cards.every((card) => card.combatType === getCombatType(card)),
      ).toBe(true);
    }
  });
  it("lets two real component identities join and hides private data", async () => {
    const { t, alice, bob, gameId } = await match();
    const a = await alice.query(api.games.get, { gameId });
    const b = await bob.query(api.games.get, { gameId });
    expect(a.me).toBe(0);
    expect(b.me).toBe(1);
    expect(a.players[0]!.hand).toHaveLength(4);
    expect(a.players[1]!.hand).toEqual([]);
    expect(b.players[1]!.hand).toHaveLength(4);
    expect(a.players[1]!.deck.map((card) => card.id)).toEqual(DEFAULT_DECK);
    expect(b.players[0]!.deck.map((card) => card.id)).toEqual(DEFAULT_DECK);
    expect(a.players[1]).not.toHaveProperty("drawPile");
    expect(a.players[1]).not.toHaveProperty("cards");
    const eve = await player(t, "eve");
    await expect(eve.query(api.games.get, { gameId })).rejects.toThrow(
      "participes",
    );
    await expect(
      eve.mutation(api.games.playCard, {
        gameId,
        cardId: "fox",
        row: 0,
        depth: 0,
        expectedTurn: 1,
      }),
    ).rejects.toThrow("participes");
  });
  it("locks snapshots even if the original deck is edited or removed", async () => {
    const { t, alice, aDeck, gameId } = await match();
    await t.run((ctx) => ctx.db.delete(aDeck));
    const game = await t.run((ctx) => ctx.db.get(gameId));
    expect(game!.state!.players[0]!.cards).toHaveLength(4);
    const view = await alice.query(api.games.get, { gameId });
    expect(view.players[0]!.deck).toEqual(game!.state!.players[0]!.cards);
  });
  it("rejects self-play, reused invitations, extra active games and unauthorized cancellations", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const bob = await player(t, "bob");
    const aDeck = await alice.mutation(api.decks.ensureStarter, {});
    const bDeck = await bob.mutation(api.decks.ensureStarter, {});
    const room = await alice.mutation(api.games.createPrivate, {
      deckId: aDeck,
    });
    await expect(
      alice.mutation(api.games.joinPrivate, { code: room.code, deckId: aDeck }),
    ).rejects.toThrow("autre joueur");
    await expect(
      alice.mutation(api.games.createPrivate, { deckId: aDeck }),
    ).rejects.toThrow("déjà");
    await expect(
      bob.mutation(api.games.cancelPrivate, { gameId: room.gameId }),
    ).rejects.toThrow("appartient");
    await bob.mutation(api.games.joinPrivate, {
      code: room.code,
      deckId: bDeck,
    });
    await expect(
      bob.mutation(api.games.joinPrivate, { code: room.code, deckId: bDeck }),
    ).rejects.toThrow("invalide");
    await expect(
      alice.mutation(api.games.cancelPrivate, { gameId: room.gameId }),
    ).rejects.toThrow("commencé");
  });
  it("expires waiting rooms and clears the host's lock", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const deckId = await alice.mutation(api.decks.ensureStarter, {});
    const room = await alice.mutation(api.games.createPrivate, { deckId });
    await vi.advanceTimersByTimeAsync(600_000);
    await t.finishInProgressScheduledFunctions();
    expect((await alice.query(api.games.activity, {})).gameId).toBeNull();
    expect((await t.run((ctx) => ctx.db.get(room.gameId)))!.status).toBe(
      "cancelled",
    );
  });
  it("an old invitation cancellation cannot clear a newer game lock", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const deckId = await alice.mutation(api.decks.ensureStarter, {});
    const old = await alice.mutation(api.games.createPrivate, { deckId });
    // Model a delayed cleanup job by expiring the record without executing it.
    await t.run((ctx) =>
      ctx.db.patch(old.gameId, { waitingExpiresAt: Date.now() - 1 }),
    );
    const newer = await alice.mutation(api.games.createPrivate, { deckId });
    await alice.mutation(api.games.cancelPrivate, { gameId: old.gameId });
    expect((await alice.query(api.games.activity, {})).gameId).toBe(
      newer.gameId,
    );
  });
  it("only one concurrent guest can claim an invitation", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const bob = await player(t, "bob");
    const eve = await player(t, "eve");
    const decks = await Promise.all(
      [alice, bob, eve].map((client) =>
        client.mutation(api.decks.ensureStarter, {}),
      ),
    );
    const room = await alice.mutation(api.games.createPrivate, {
      deckId: decks[0]!,
    });
    const results = await Promise.allSettled([
      bob.mutation(api.games.joinPrivate, {
        code: room.code,
        deckId: decks[1]!,
      }),
      eve.mutation(api.games.joinPrivate, {
        code: room.code,
        deckId: decks[2]!,
      }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const game = await t.run((ctx) => ctx.db.get(room.gameId));
    expect(game!.state!.players).toHaveLength(2);
  });
});
describe("tours autoritaires", () => {
  it("synchronizes withdrawals before playing and protects ownership", async () => {
    const { t, alice, bob, gameId } = await match();
    const initial = await alice.query(api.games.get, { gameId });
    const active = initial.activePlayer === 0 ? alice : bob;
    const inactive = initial.activePlayer === 0 ? bob : alice;
    const own = await active.query(api.games.get, { gameId });
    const cardId = own.players[own.me]!.hand[0]!.id;
    await t.run(async (ctx) => {
      const game = (await ctx.db.get(gameId))!;
      const state = game.state!;
      const owner = state.players[own.me]!;
      const card = owner.cards.find((card) => card.id === cardId)!;
      owner.hand = owner.hand.filter((id) => id !== cardId);
      owner.board.push({
        cardId,
        row: 0,
        depth: getCombatType(card) === "melee" ? 0 : 2,
        hp: card.health,
      });
      await ctx.db.patch(gameId, { state });
    });
    const eve = await player(t, "eve");
    await expect(
      eve.mutation(api.games.withdrawCard, { gameId, cardId, expectedTurn: 1 }),
    ).rejects.toThrow("participes");
    await expect(
      inactive.mutation(api.games.withdrawCard, {
        gameId,
        cardId,
        expectedTurn: 1,
      }),
    ).rejects.toThrow("tour");
    await expect(
      active.mutation(api.games.withdrawCard, {
        gameId,
        cardId,
        expectedTurn: 0,
      }),
    ).rejects.toThrow("changé");
    await expect(
      active.mutation(api.games.withdrawCard, {
        gameId,
        cardId: "missing",
        expectedTurn: 1,
      }),
    ).rejects.toThrow("camp");
    await active.mutation(api.games.withdrawCard, {
      gameId,
      cardId,
      expectedTurn: 1,
    });
    const other = await inactive.query(api.games.get, { gameId });
    expect(other.players[own.me]!.board).toEqual([]);
    expect(other.players[own.me]!.discardCount).toBe(1);
    expect(other.players[own.me]!.handCount).toBe(3);
    expect(other.events.at(-1)!.type).toBe("withdraw");
    expect(other.hasSummoned).toBe(false);
    expect(other.turn).toBe(1);
    await expect(
      active.mutation(api.games.withdrawCard, {
        gameId,
        cardId,
        expectedTurn: 1,
      }),
    ).rejects.toThrow("camp");
    const card = own.players[own.me]!.hand[1]!;
    await active.mutation(api.games.playCard, {
      gameId,
      cardId: card.id,
      row: 0,
      depth: getCombatType(card) === "melee" ? 0 : 2,
      expectedTurn: 1,
    });
    expect((await inactive.query(api.games.get, { gameId })).turn).toBe(2);
  });
  it("synchronizes placement, combat and the next turn, rejecting invalid zones and stale plays", async () => {
    const { alice, bob, gameId } = await match();
    const initial = await alice.query(api.games.get, { gameId });
    const active = initial.activePlayer === 0 ? alice : bob;
    const inactive = initial.activePlayer === 0 ? bob : alice;
    const own = await active.query(api.games.get, { gameId });
    const card = own.players[own.me]!.hand[0]!;
    const cardId = card.id;
    const depth = getCombatType(card) === "melee" ? 0 : 2;
    await expect(
      inactive.mutation(api.games.playCard, {
        gameId,
        cardId,
        row: 0,
        depth: 0,
        expectedTurn: 1,
      }),
    ).rejects.toThrow("tour");
    await expect(
      active.mutation(api.games.playCard, {
        gameId,
        cardId,
        row: 0,
        depth: depth === 0 ? 2 : 0,
        expectedTurn: 1,
      }),
    ).rejects.toThrow("colonnes");
    await active.mutation(api.games.playCard, {
      gameId,
      cardId,
      row: 0,
      depth,
      expectedTurn: 1,
    });
    const other = await inactive.query(api.games.get, { gameId });
    expect(other.players[own.me]!.board[0]!.cardId).toBe(cardId);
    expect(other.players[other.me]!.heroHp).toBe(30 - card.attack);
    expect(other.activePlayer).toBe(other.me);
    expect(other.turn).toBe(2);
    expect(other.events.map((event) => event.type)).toEqual([
      "summon",
      "attack",
      "turn",
    ]);
    await expect(
      active.mutation(api.games.playCard, {
        gameId,
        cardId,
        row: 1,
        depth: 0,
        expectedTurn: 1,
      }),
    ).rejects.toThrow("changé");
    await expect(
      active.mutation(api.games.endTurn, { gameId, expectedTurn: 1 }),
    ).rejects.toThrow("changé");
    expect((await inactive.query(api.games.get, { gameId })).turn).toBe(2);
  });
  it("ignores the old deadline after a card is played and schedules the next player's deadline", async () => {
    const { t, alice, bob, gameId } = await match();
    const initial = await alice.query(api.games.get, { gameId });
    const active = initial.activePlayer === 0 ? alice : bob;
    const own = await active.query(api.games.get, { gameId });
    const card = own.players[own.me]!.hand[0]!;
    await vi.advanceTimersByTimeAsync(59_000);
    await active.mutation(api.games.playCard, {
      gameId,
      cardId: card.id,
      row: 0,
      depth: getCombatType(card) === "melee" ? 0 : 2,
      expectedTurn: 1,
    });
    await vi.advanceTimersByTimeAsync(1_000);
    await t.finishInProgressScheduledFunctions();
    await t.mutation(internal.games.expireTurn, { gameId, expectedTurn: 1 });
    expect((await alice.query(api.games.get, { gameId })).turn).toBe(2);
    await vi.advanceTimersByTimeAsync(59_000);
    await t.finishInProgressScheduledFunctions();
    expect((await alice.query(api.games.get, { gameId })).turn).toBe(3);
  });
  it("advances disconnected players at the server deadline", async () => {
    const { t, alice, gameId } = await match();
    await vi.advanceTimersByTimeAsync(60_000);
    await t.finishInProgressScheduledFunctions();
    expect((await alice.query(api.games.get, { gameId })).turn).toBe(2);
  });
  it("surrender ends the game, releases both players and makes old deadlines harmless", async () => {
    const { t, alice, bob, gameId } = await match();
    await alice.mutation(api.games.surrender, { gameId });
    expect((await bob.query(api.games.get, { gameId })).winner).toBe(1);
    expect((await bob.query(api.games.activity, {})).gameId).toBeNull();
    expect((await alice.query(api.games.activity, {})).gameId).toBeNull();
    await vi.advanceTimersByTimeAsync(60_000);
    await t.finishInProgressScheduledFunctions();
    expect((await alice.query(api.games.get, { gameId })).turn).toBe(1);
  });
});
describe("recherche d’adversaire", () => {
  it("matches two players into the same game and clears their queue entries", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const bob = await player(t, "bob");
    const aDeck = await alice.mutation(api.decks.ensureStarter, {});
    const bDeck = await bob.mutation(api.decks.ensureStarter, {});
    expect(
      (await alice.mutation(api.matchmaking.enqueue, { deckId: aDeck })).gameId,
    ).toBeNull();
    const paired = await bob.mutation(api.matchmaking.enqueue, {
      deckId: bDeck,
    });
    expect(paired.gameId).not.toBeNull();
    expect((await alice.query(api.games.activity, {})).gameId).toBe(
      paired.gameId,
    );
    expect((await bob.query(api.games.activity, {})).gameId).toBe(
      paired.gameId,
    );
    expect(
      await t.run((ctx) => ctx.db.query("matchmakingQueue").collect()),
    ).toEqual([]);
    await expect(
      alice.mutation(api.matchmaking.enqueue, { deckId: aDeck }),
    ).rejects.toThrow("déjà");
    await alice.mutation(api.matchmaking.cancel, {});
    expect((await alice.query(api.games.activity, {})).gameId).toBe(
      paired.gameId,
    );
  });
  it("expires departed players and does not match them", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const bob = await player(t, "bob");
    const aDeck = await alice.mutation(api.decks.ensureStarter, {});
    const bDeck = await bob.mutation(api.decks.ensureStarter, {});
    await alice.mutation(api.matchmaking.enqueue, { deckId: aDeck });
    await vi.advanceTimersByTimeAsync(45_000);
    await t.finishInProgressScheduledFunctions();
    expect((await alice.query(api.games.activity, {})).queued).toBe(false);
    expect(
      (await bob.mutation(api.matchmaking.enqueue, { deckId: bDeck })).gameId,
    ).toBeNull();
  });
  it("extends presence while waiting and cancels cleanly", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const deckId = await alice.mutation(api.decks.ensureStarter, {});
    await alice.mutation(api.matchmaking.enqueue, { deckId });
    await vi.advanceTimersByTimeAsync(30_000);
    await alice.mutation(api.matchmaking.heartbeat, {});
    await vi.advanceTimersByTimeAsync(20_000);
    await t.finishInProgressScheduledFunctions();
    expect((await alice.query(api.games.activity, {})).queued).toBe(true);
    await alice.mutation(api.matchmaking.cancel, {});
    expect((await alice.query(api.games.activity, {})).queued).toBe(false);
  });
});
