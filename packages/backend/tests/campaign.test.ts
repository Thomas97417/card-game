import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCombatType } from "@sylve/game";
import { campaignStageReward } from "@sylve/game/campaign";
import { api, components } from "../convex/_generated/api";
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
  const user = await t.mutation(components.betterAuth.adapter.create, { input: {
    model: "user", data: { name, email: `${name}@example.invalid`, emailVerified: true, createdAt: Date.now(), updatedAt: Date.now() },
  } });
  const session = await t.mutation(components.betterAuth.adapter.create, { input: {
    model: "session", data: { userId: user._id, token: `${name}-session`, createdAt: Date.now(), updatedAt: Date.now(), expiresAt: Date.now() + 86400000 },
  } });
  const client = t.withIdentity({ subject: user._id, sessionId: session._id });
  const deckId = await client.mutation(api.decks.ensureStarter, {});
  return { client, deckId, ownerId: String(user._id) };
}
type Player = Awaited<ReturnType<typeof player>>;
async function win(t: Test, alice: Player, region: number, stage: number) {
  const gameId = await alice.client.mutation(api.games.createCampaign, { deckId: alice.deckId, region, stage });
  await t.run(async (ctx) => {
    const game = (await ctx.db.get(gameId))!;
    const state = game.state!;
    state.players[1]!.heroHp = 1;
    for (const owner of state.players) { owner.board = []; owner.runes = []; owner.pentagrams = []; }
    await ctx.db.patch(gameId, { state });
  });
  const data = await alice.client.query(api.games.get, { gameId });
  const card = data.players[0]!.hand.find((card) => getCombatType(card) !== "building")!;
  await alice.client.mutation(api.games.playCard, { gameId, cardId: card.id, row: 0, depth: getCombatType(card) === "melee" ? 0 : 2, expectedTurn: 1 });
  expect((await alice.client.query(api.games.get, { gameId })).status).toBe("finished");
  return gameId;
}
async function wallet(t: Test, ownerId: string) {
  return t.run((ctx) => ctx.db.query("wallets").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).unique());
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("campagne autoritaire", () => {
  it("requires authentication, valid coordinates, an owned complete deck, and unlocked stages", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const bob = await player(t, "bob");
    await expect(t.query(api.games.campaignBoard, {})).rejects.toThrow("Connecte-toi");
    await expect(t.mutation(api.games.createCampaign, { deckId: alice.deckId, region: 1, stage: 1 })).rejects.toThrow("Connecte-toi");
    for (const [region, stage] of [[0,1], [5,1], [1,11], [1,0], [1.5,1]]) {
      await expect(alice.client.mutation(api.games.createCampaign, { deckId: alice.deckId, region: region!, stage: stage! })).rejects.toThrow("n’existe pas");
    }
    await expect(alice.client.mutation(api.games.createCampaign, { deckId: alice.deckId, region: 1, stage: 2 })).rejects.toThrow("précédente");
    await expect(alice.client.mutation(api.games.createCampaign, { deckId: alice.deckId, region: 2, stage: 1 })).rejects.toThrow("précédente");
    await expect(bob.client.mutation(api.games.createCampaign, { deckId: alice.deckId, region: 1, stage: 1 })).rejects.toThrow("appartient pas");
    await t.run(async (ctx) => {
      const deck = (await ctx.db.get(alice.deckId))!;
      const savedWallet = await ctx.db.query("wallets").withIndex("by_owner", (q) => q.eq("ownerId", alice.ownerId)).unique();
      if (savedWallet) await ctx.db.patch(savedWallet._id, { catalogueVersion: 2 });
      else await ctx.db.insert("wallets", { ownerId: alice.ownerId, gold: 0, catalogueVersion: 2 });
      await ctx.db.patch(alice.deckId, { cardIds: deck.cardIds.slice(0, 1) });
    });
    await expect(alice.client.mutation(api.games.createCampaign, { deckId: alice.deckId, region: 1, stage: 1 })).rejects.toThrow("Complète ton deck");
  });

  it("saves the region and stage, prevents simultaneous matches, and grants nothing for surrender", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const initial = await wallet(t, alice.ownerId);
    const gameId = await alice.client.mutation(api.games.createCampaign, { deckId: alice.deckId, region: 1, stage: 1 });
    const data = await alice.client.query(api.games.get, { gameId });
    expect(data).toMatchObject({ mode: "solo", campaign: { region: 1, stage: 1 }, activePlayer: 0 });
    expect(data.players[1]!.name).toBe("Sentinelle · 1-1");
    await expect(alice.client.mutation(api.games.createSolo, { deckId: alice.deckId })).rejects.toThrow("déjà une partie");
    await alice.client.mutation(api.games.surrender, { gameId });
    expect(await alice.client.query(api.games.campaignBoard, {})).toEqual({ completedStages: 0, chests: [] });
    expect(await wallet(t, alice.ownerId)).toEqual(initial);
    const final = await alice.client.query(api.games.get, { gameId });
    expect(final.campaignReward).toBeNull();
    expect(final.trophyChange).toBeNull();
    expect((await alice.client.query(api.games.activity, {})).gameId).toBeNull();
  });

  it("credits first clears once, unlocks the next stage, and makes replays reward-free", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const initial = await wallet(t, alice.ownerId);
    const gameId = await win(t, alice, 1, 1);
    expect((await alice.client.query(api.games.get, { gameId })).campaignReward).toEqual({ firstClear: true, gold: 60, emeralds: 0 });
    expect((await wallet(t, alice.ownerId))!.gold).toBe((initial?.gold ?? 0) + 60);
    expect((await alice.client.query(api.games.campaignBoard, {})).completedStages).toBe(1);
    await expect(alice.client.mutation(api.games.surrender, { gameId })).rejects.toThrow();
    const replay = await win(t, alice, 1, 1);
    expect((await alice.client.query(api.games.get, { gameId: replay })).campaignReward).toEqual({ firstClear: false, gold: 0, emeralds: 0 });
    expect((await wallet(t, alice.ownerId))!.gold).toBe((initial?.gold ?? 0) + 60);
    await win(t, alice, 1, 2);
    expect((await alice.client.query(api.games.campaignBoard, {})).completedStages).toBe(2);
    const extra = await t.run(async (ctx) => ({ trophies: await ctx.db.query("leagueProgress").collect(), chests: await ctx.db.query("chests").collect(), victory: await ctx.db.query("victoryChests").collect() }));
    expect(extra).toEqual({ trophies: [], chests: [], victory: [] });
  });

  it("keeps a guaranteed boss chest across visits, hides its loot, and opens it atomically once", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const bob = await player(t, "bob");
    await t.run((ctx) => ctx.db.insert("campaignProgress", { ownerId: alice.ownerId, completedStages: 9 }));
    const initial = await wallet(t, alice.ownerId);
    const gameId = await win(t, alice, 1, 10);
    const result = (await alice.client.query(api.games.get, { gameId })).campaignReward!;
    expect(result).toMatchObject({ firstClear: true, ...{ gold: campaignStageReward(1,10).gold, emeralds: 25 } });
    expect(result.chestId).toBeTruthy();
    const board = await alice.client.query(api.games.campaignBoard, {});
    expect(board).toEqual({ completedStages: 10, chests: [{ id: result.chestId, region: 1, opened: false }] });
    expect((await wallet(t, alice.ownerId))!.diamonds).toBe((initial?.diamonds ?? 3000) + 25);
    const chestId = result.chestId as Id<"campaignChests">;
    await expect(t.mutation(api.games.openCampaignChest, { chestId })).rejects.toThrow("Connecte-toi");
    await expect(bob.client.mutation(api.games.openCampaignChest, { chestId })).rejects.toThrow("appartient pas");
    const before = await wallet(t, alice.ownerId);
    const [first, retry] = await Promise.all([
      alice.client.mutation(api.games.openCampaignChest, { chestId }),
      alice.client.mutation(api.games.openCampaignChest, { chestId }),
    ]);
    expect(retry).toEqual(first);
    expect(first.rarity).toBe("epic");
    expect(first.reveals.length).toBeGreaterThan(0);
    expect((await wallet(t, alice.ownerId))!.gold).toBe(before!.gold + first.gold);
    const collection = await alice.client.query(api.collection.list, {});
    for (const reveal of first.reveals) expect(collection.find((entry) => entry.card.id === reveal.variantId)!.copies).toBe(reveal.copies);
    expect((await alice.client.query(api.games.campaignBoard, {})).chests[0]!.opened).toBe(true);
    const nextGame = await alice.client.mutation(api.games.createCampaign, { deckId: alice.deckId, region: 2, stage: 1 });
    expect((await alice.client.query(api.games.get, { gameId: nextGame })).campaign).toEqual({ region: 2, stage: 1 });
    await alice.client.mutation(api.games.surrender, { gameId: nextGame });
    await win(t, alice, 1, 10);
    expect((await alice.client.query(api.games.campaignBoard, {})).chests).toHaveLength(1);
  });
});
