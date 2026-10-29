import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { describe, expect, it } from "vitest";
import { DEFAULT_DECK, resolveCard } from "@sylve/game";
import { api, components } from "../convex/_generated/api";
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
  return {
    ownerId: String(user._id),
    client: t.withIdentity({ subject: user._id, sessionId: session._id }),
  };
}

describe("classement public des gardiens", () => {
  it("requires a connected player for the ranking and profiles", async () => {
    const t = setup();
    await expect(t.query(api.collection.leaderboard, {})).rejects.toThrow("Connecte-toi");
    await expect(
      t.query(api.collection.playerProfile, { ownerId: "unknown" }),
    ).rejects.toThrow("Connecte-toi");
    const alice = await player(t, "alice");
    expect(await alice.client.query(api.collection.leaderboard, {})).toEqual([]);
    expect(await alice.client.query(api.collection.playerProfile, { ownerId: "unknown" })).toBeNull();
    expect(await alice.client.query(api.collection.playerProfile, { ownerId: alice.ownerId })).toMatchObject({
      rank: 1,
      guardian: { heroId: "sylve", level: 1 },
      trophies: 0,
      deck: null,
    });
  });

  it("shows live public rank and active guardian without exposing experience, rewards or currency", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const bob = await player(t, "bob");
    const [walletId, heroId] = await t.run(async (ctx) => Promise.all([
      ctx.db.insert("wallets", {
        ownerId: bob.ownerId, gold: 999, diamonds: 50, experience: 24,
        rankRewardedThrough: 2, rankAcknowledgedThrough: 1,
      }),
      ctx.db.insert("heroes", {
        ownerId: bob.ownerId, selectedHeroId: "moon", level: 5, peakMight: 100,
        unlockedHeroIds: ["sylve", "moon", "thorn"],
      }),
    ]));
    const profile = await alice.client.query(api.collection.playerProfile, { ownerId: bob.ownerId });
    expect(profile).toEqual({
      rank: 2,
      guardian: { heroId: "moon", level: 5 },
      trophies: 0, peakTrophies: 0, deckCapacity: 4, deck: null,
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(walletId, { experience: 150 });
      await ctx.db.patch(heroId, { selectedHeroId: "thorn", level: 8 });
    });
    expect(await alice.client.query(api.collection.playerProfile, { ownerId: bob.ownerId })).toMatchObject({
      rank: 6,
      guardian: { heroId: "thorn", level: 8 },
    });
  });

  it("orders current trophies with stable ties, skips deleted accounts and exposes public scores and the current guardian", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const bob = await player(t, "bob");
    const clara = await player(t, "clara");
    const bobHero = await t.run(async (ctx) => {
      await ctx.db.insert("leagueProgress", { ownerId: alice.ownerId, trophies: 800, peakTrophies: 5000 });
      await ctx.db.insert("leagueProgress", { ownerId: bob.ownerId, trophies: 2400 });
      await ctx.db.insert("leagueProgress", { ownerId: clara.ownerId, trophies: 2400 });
      await ctx.db.insert("leagueProgress", { ownerId: "deleted-user", trophies: 9999 });
      return ctx.db.insert("heroes", { ownerId: bob.ownerId, selectedHeroId: "moon", level: 1, peakMight: 0 });
    });
    const ranking = await alice.client.query(api.collection.leaderboard, {});
    expect(ranking.map((entry) => entry.trophies)).toEqual([2400, 2400, 800]);
    expect(ranking.map((entry) => entry.rank)).toEqual([1, 2, 3]);
    expect(ranking.filter((entry) => entry.isCurrentPlayer)).toEqual([
      { ownerId: alice.ownerId, name: "alice", trophies: 800, rank: 3, isCurrentPlayer: true, profile: { heroId: "sylve" } },
    ]);
    expect(ranking).toEqual(await alice.client.query(api.collection.leaderboard, {}));
    expect(Object.keys(ranking[0]!).sort()).toEqual(["isCurrentPlayer", "name", "ownerId", "profile", "rank", "trophies"]);
    expect(ranking.find((entry) => entry.ownerId === bob.ownerId)!.profile).toEqual({ heroId: "moon" });
    await t.run((ctx) => ctx.db.patch(bobHero, { selectedHeroId: "void" }));
    const updated = await alice.client.query(api.collection.leaderboard, {});
    expect(updated.find((entry) => entry.ownerId === bob.ownerId)!.profile).toEqual({ heroId: "void" });
    expect(updated.map((entry) => entry.ownerId)).toEqual(ranking.map((entry) => entry.ownerId));
  });

  it("shows the current deck in order with owned levels, earned capacity and no private collection data", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const bob = await player(t, "bob");
    await bob.client.mutation(api.decks.ensureStarter, {});
    const cardIds = [...DEFAULT_DECK].reverse();
    await t.run(async (ctx) => {
      await ctx.db.insert("leagueProgress", { ownerId: bob.ownerId, trophies: 100, peakTrophies: 800 });
      const owned = await ctx.db.query("collection").withIndex("by_owner_variant", (q) =>
        q.eq("ownerId", bob.ownerId).eq("variantId", cardIds[0]!),
      ).unique();
      await ctx.db.patch(owned!._id, { level: 7, copies: 999 });
      await ctx.db.insert("collection", { ownerId: bob.ownerId, variantId: "fox:common", level: 5, copies: 10 });
      await ctx.db.insert("decks", {
        ownerId: bob.ownerId,
        name: "Le cercle des anciens",
        cardIds,
        updatedAt: Date.now() + 1000,
      });
    });
    const profile = await alice.client.query(api.collection.playerProfile, { ownerId: bob.ownerId });
    expect(profile).toMatchObject({ trophies: 100, peakTrophies: 800, deckCapacity: 6 });
    expect(profile?.deck?.name).toBe("Le cercle des anciens");
    expect(profile?.deck?.cards.map((card) => card.id)).toEqual(cardIds);
    expect(profile?.deck?.cards[0]).toEqual(resolveCard(cardIds[0]!, 7));
    expect(profile?.deck?.cards).toHaveLength(4);
    expect(Object.keys(profile!).sort()).toEqual(["deck", "deckCapacity", "guardian", "peakTrophies", "rank", "trophies"]);
  });
});
