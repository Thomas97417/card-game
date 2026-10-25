import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DECK, resolveCard } from "@sylve/game";
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
        expiresAt: now + 86400000,
      },
    },
  });
  return t.withIdentity({ subject: user._id, sessionId: session._id });
}
async function fixture() {
  const t = setup(),
    alice = await player(t, "alice"),
    bob = await player(t, "bob");
  const deckId = await alice.mutation(api.decks.ensureStarter, {});
  const bobDeck = await bob.mutation(api.decks.ensureStarter, {});
  const ownerId = (await t.run((ctx) => ctx.db.get(deckId)))!.ownerId;
  return { t, alice, bob, deckId, bobDeck, ownerId };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("niveaux et pouvoirs persistants du héros", () => {
  it("requires authentication and starts with 400 deck might, 45 HP and no paid promotion", async () => {
    const { t, alice } = await fixture();
    await expect(t.query(api.collection.hero, {})).rejects.toThrow(
      "Connecte-toi",
    );
    expect(await alice.query(api.collection.hero, {})).toMatchObject({
      level: 1,
      health: 45,
      might: 400,
      peakMight: 400,
      nextMight: 870,
      canUpgrade: false,
    });
    await expect(
      alice.mutation(api.collection.upgradeHero, { expectedLevel: 1 }),
    ).rejects.toThrow("insuffisante");
    expect(await t.run((ctx) => ctx.db.query("heroes").collect())).toHaveLength(
      2,
    );
  });
  it("preserves reached thresholds after replacing the deck, and serializes simultaneous promotions", async () => {
    const { t, alice, deckId, ownerId } = await fixture();
    await t.run((ctx) =>
      ctx.db.insert("collection", {
        ownerId,
        variantId: "guardian:legendary",
        level: 20,
        copies: 0,
      }),
    );
    const strong = ["guardian:legendary", ...DEFAULT_DECK.slice(1)];
    await alice.mutation(api.decks.save, {
      deckId,
      name: "Fort",
      cardIds: strong,
    });
    const peak = (await alice.query(api.collection.hero, {})).peakMight;
    expect(peak).toBeGreaterThan(870);
    await alice.mutation(api.decks.save, {
      deckId,
      name: "Départ",
      cardIds: [...DEFAULT_DECK],
    });
    expect(await alice.query(api.collection.hero, {})).toMatchObject({
      might: 400,
      peakMight: peak,
      canUpgrade: true,
    });
    const attempts = await Promise.allSettled([
      alice.mutation(api.collection.upgradeHero, { expectedLevel: 1 }),
      alice.mutation(api.collection.upgradeHero, { expectedLevel: 1 }),
    ]);
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(1);
    expect(await alice.query(api.collection.hero, {})).toMatchObject({
      level: 2,
      health: 49,
      might: 410,
      peakMight: peak,
    });
    await alice.mutation(api.decks.ensureStarter, {});
    expect((await alice.query(api.collection.hero, {})).level).toBe(2);
  });
  it("records might earned by improving an equipped card, with no reserve copies counted", async () => {
    const { t, alice, ownerId } = await fixture();
    await t.run(async (ctx) => {
      const card = (await ctx.db
        .query("collection")
        .withIndex("by_owner_variant", (q) =>
          q.eq("ownerId", ownerId).eq("variantId", DEFAULT_DECK[0]!),
        )
        .unique())!;
      await ctx.db.patch(card._id, { copies: 100 });
      await ctx.db.insert("wallets", {
        ownerId,
        gold: 10000,
        catalogueVersion: 2,
      });
      await ctx.db.insert("collection", {
        ownerId,
        variantId: "guardian:legendary",
        level: 26,
        copies: 9999,
      });
    });
    const before = await alice.query(api.collection.hero, {});
    await alice.mutation(api.collection.upgrade, {
      variantId: DEFAULT_DECK[0]!,
    });
    const after = await alice.query(api.collection.hero, {});
    expect(after.might - before.might).toBe(
      resolveCard(DEFAULT_DECK[0]!, 2).might! - 100,
    );
    expect(after.peakMight).toBe(after.might);
  });
  it("snapshots each hero for private, public and solo matches", async () => {
    for (const mode of ["private", "public", "solo"] as const) {
      const { t, alice, bob, deckId, bobDeck, ownerId } = await fixture();
      await t.run(async (ctx) => {
        const hero = (await ctx.db
          .query("heroes")
          .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
          .unique())!;
        await ctx.db.patch(hero._id, { level: 11, peakMight: 3000 });
      });
      let gameId;
      if (mode === "solo")
        gameId = await alice.mutation(api.games.createSolo, { deckId });
      else if (mode === "private") {
        const invite = await alice.mutation(api.games.createPrivate, {
          deckId,
        });
        // A later level must not change the invitation's snapshot.
        await alice.mutation(api.collection.upgradeHero, { expectedLevel: 11 });
        gameId = await bob.mutation(api.games.joinPrivate, {
          code: invite.code,
          deckId: bobDeck,
        });
      } else {
        await alice.mutation(api.matchmaking.enqueue, { deckId });
        gameId = (
          await bob.mutation(api.matchmaking.enqueue, { deckId: bobDeck })
        ).gameId!;
      }
      const game = await alice.query(api.games.get, { gameId });
      expect(game.players[game.me]).toMatchObject({
        heroLevel: 11,
        heroHp: 80,
        heroMaxHp: 80,
        heroAbilityUses: 0,
      });
      expect(game.players[1 - game.me]!.heroHp).toBe(45);
    }
  });
  it("validates ownership and order and persists one cast across retries without consuming deployment", async () => {
    const { t, alice, bob, deckId } = await fixture();
    const gameId = await alice.mutation(api.games.createSolo, { deckId });
    const args = {
      gameId,
      abilityId: "storm" as const,
      expectedUses: 0,
      expectedTurn: 1,
    };
    await expect(bob.mutation(api.games.playHeroAbility, args)).rejects.toThrow(
      "participes",
    );
    await expect(
      alice.mutation(api.games.playHeroAbility, {
        ...args,
        abilityId: "call_to_arms",
      }),
    ).rejects.toThrow("premier pouvoir");
    const before = (await t.run((ctx) => ctx.db.get(gameId)))!.state!;
    await expect(
      alice.mutation(api.games.playHeroAbility, args),
    ).rejects.toThrow("tour 2");
    expect((await t.run((ctx) => ctx.db.get(gameId)))!.state).toEqual(before);
    await t.run((ctx) =>
      ctx.db.patch(gameId, { state: { ...before, turn: 3 } }),
    );
    args.expectedTurn = 3;
    await alice.mutation(api.games.playHeroAbility, args);
    await expect(
      alice.mutation(api.games.playHeroAbility, args),
    ).rejects.toThrow("pile");
    const game = await alice.query(api.games.get, { gameId });
    expect(game).toMatchObject({
      turn: 3,
      activePlayer: 0,
      hasSummoned: false,
    });
    expect(game.players[0]!.heroAbilityUses).toBe(1);
    expect(game.players[0]!.hand).toHaveLength(4);
    expect(game.events.filter((e) => e.type === "hero_ability")).toHaveLength(
      1,
    );
    expect(
      (await t.run((ctx) => ctx.db.get(gameId)))!.state!.players[0]!
        .heroAbilityUses,
    ).toBe(1);
  });
  it("awards a spell victory once", async () => {
    const { t, alice, deckId } = await fixture();
    const gameId = await alice.mutation(api.games.createSolo, { deckId });
    await t.run(async (ctx) => {
      const state = (await ctx.db.get(gameId))!.state!;
      state.turn = 21;
      state.players[0]!.heroLevel = 21;
      state.players[0]!.heroAbilityUses = 3;
      state.players[1]!.heroHp = 1;
      await ctx.db.patch(gameId, { state });
    });
    const args = {
      gameId,
      abilityId: "sudden_death" as const,
      expectedUses: 3,
      expectedTurn: 21,
    };
    await alice.mutation(api.games.playHeroAbility, args);
    const won = await alice.query(api.games.get, { gameId });
    expect(won).toMatchObject({ status: "finished", winner: 0 });
    expect(won.reward?.status).toBe("awarded");
    expect((await alice.query(api.collection.league, {})).trophies).toBe(25);
    await expect(
      alice.mutation(api.games.playHeroAbility, args),
    ).rejects.toThrow("terminée");
    expect((await alice.query(api.collection.league, {})).trophies).toBe(25);
  });
  it("synchronizes spell damage and the spent pile in a private duel", async () => {
    const { t, alice, bob, deckId, bobDeck } = await fixture();
    const invitation = await alice.mutation(api.games.createPrivate, {
      deckId,
    });
    const gameId = await bob.mutation(api.games.joinPrivate, {
      code: invitation.code,
      deckId: bobDeck,
    });
    await t.run(async (ctx) => {
      const state = (await ctx.db.get(gameId))!.state!;
      state.activePlayer = 0;
      state.turn = 3;
      for (const player of state.players) {
        player.board = [];
        player.runes = [];
        player.pentagrams = [];
      }
      state.players[1]!.board.push({
        cardId: state.players[1]!.cards[0]!.id,
        row: 0,
        depth: 0,
        hp: 2,
      });
      await ctx.db.patch(gameId, { state });
    });
    await alice.mutation(api.games.playHeroAbility, {
      gameId,
      abilityId: "storm",
      expectedUses: 0,
      expectedTurn: 3,
    });
    const other = await bob.query(api.games.get, { gameId });
    expect(other.players[0]!.heroAbilityUses).toBe(1);
    expect(other.players[1]!.board).toHaveLength(0);
    expect(other.players[0]!.hand).toEqual([]);
    expect(other).toMatchObject({
      turn: 3,
      activePlayer: 0,
      hasSummoned: false,
    });
    await expect(
      bob.mutation(api.games.playHeroAbility, {
        gameId,
        abilityId: "storm",
        expectedUses: 0,
        expectedTurn: 3,
      }),
    ).rejects.toThrow("ton tour");
  });
  it("persists hero reinforcements without granting played-card mission progress", async () => {
    const { t, alice, deckId, ownerId } = await fixture();
    const gameId = await alice.mutation(api.games.createSolo, { deckId });
    await t.run(async (ctx) => {
      const state = (await ctx.db.get(gameId))!.state!;
      state.turn = 5;
      state.players[0]!.heroLevel = 11;
      state.players[0]!.heroAbilityUses = 1;
      state.players[0]!.board = [];
      await ctx.db.patch(gameId, { state });
    });
    await alice.mutation(api.games.playHeroAbility, {
      gameId,
      abilityId: "call_to_arms",
      expectedUses: 1,
      expectedTurn: 5,
    });
    const view = await alice.query(api.games.get, { gameId });
    expect(
      view.players[0]!.board.filter((u) => u.definition?.kind === "archer"),
    ).toHaveLength(2);
    expect(view.players[0]!.hand).toHaveLength(4);
    const missions = await t.run((ctx) =>
      ctx.db
        .query("missionProgress")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .unique(),
    );
    expect(missions?.lifetime.cardsPlayed ?? 0).toBe(0);
    expect(
      view.events.filter((e) => e.type === "summon" && e.unit?.definition),
    ).toHaveLength(2);
  });
  it("lets solo AI cast before playing and ignores a stale recovery job for that same turn", async () => {
    const { t, alice, deckId } = await fixture();
    const gameId = await alice.mutation(api.games.createSolo, { deckId });
    await t.run(async (ctx) => {
      const state = (await ctx.db.get(gameId))!.state!;
      state.turn = 4;
      state.activePlayer = 1;
      for (const player of state.players) {
        player.board = [];
        player.runes = [];
        player.pentagrams = [];
      }
      const card = state.players[0]!.cards[0]!;
      state.players[0]!.board.push({
        cardId: card.id,
        row: 0,
        depth: 0,
        hp: card.health,
      });
      await ctx.db.patch(gameId, { state });
    });
    await alice.mutation(api.games.soloTurn, {
      gameId,
      expectedTurn: 4,
      expectedSequence: 0,
    });
    const cast = await alice.query(api.games.get, { gameId });
    expect(cast).toMatchObject({ turn: 4, activePlayer: 1 });
    expect(cast.players[1]!.heroAbilityUses).toBe(1);
    await alice.mutation(api.games.soloTurn, {
      gameId,
      expectedTurn: 4,
      expectedSequence: 0,
    });
    expect((await alice.query(api.games.get, { gameId })).sequence).toBe(
      cast.sequence,
    );
    await t.mutation(internal.games.soloTurnFallback, {
      gameId,
      expectedTurn: 4,
      expectedSequence: 0,
    });
    expect((await alice.query(api.games.get, { gameId })).sequence).toBe(
      cast.sequence,
    );
    await alice.mutation(api.games.soloTurn, {
      gameId,
      expectedTurn: 4,
      expectedSequence: cast.sequence,
    });
    expect((await alice.query(api.games.get, { gameId })).turn).toBe(5);
  });
});
