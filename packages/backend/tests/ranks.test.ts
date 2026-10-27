import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogueMigration, rankProgress } from "@sylve/game";
import { HOUR_MS } from "@sylve/game/mines";
import { api, components } from "../convex/_generated/api";
import schema from "../convex/schema";
import { addRankExperience } from "../convex/lib/ranks";
import { friendshipPair } from "../convex/lib/social";

const modules = import.meta.glob("../convex/**/*.ts");
function setup() {
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
  return t;
}
type Test = ReturnType<typeof setup>;

async function player(t: Test, name: string, experience = 0) {
  const now = Date.now();
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: {
      name, email: `${name}@example.invalid`, emailVerified: true,
      createdAt: now, updatedAt: now,
    } },
  });
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "session", data: {
      userId: user._id, token: `${name}-session`, createdAt: now, updatedAt: now,
      expiresAt: now + 7 * 24 * HOUR_MS,
    } },
  });
  const ownerId = String(user._id);
  const walletId = await t.run((ctx) => ctx.db.insert("wallets", {
    ownerId, gold: 100000, diamonds: 0, experience, catalogueVersion: 2,
  }));
  const client = t.withIdentity({ subject: user._id, sessionId: session._id });
  return { ownerId, walletId, client };
}
afterEach(() => vi.useRealTimers());

describe("automatic account rank progression", () => {
  it("authenticates private progress and refuses forged acknowledgments or another account", async () => {
    const t = setup();
    await expect(t.query(api.collection.rank, {})).rejects.toThrow("Connecte-toi");
    await expect(t.mutation(api.collection.ensureRank, { expectedOwnerId: "alice" })).rejects.toThrow("Connecte-toi");
    await expect(t.mutation(api.collection.acknowledgeRank, { expectedOwnerId: "alice", throughRank: 2 })).rejects.toThrow("Connecte-toi");
    const a = await player(t, "alice");
    await expect(a.client.mutation(api.collection.ensureRank, { expectedOwnerId: "bob" })).rejects.toThrow("session");
    await expect(a.client.mutation(api.collection.acknowledgeRank, { expectedOwnerId: "bob", throughRank: 1 })).rejects.toThrow("session");
    for (const throughRank of [0, 1.5, 2, 1001])
      await expect(a.client.mutation(api.collection.acknowledgeRank, { expectedOwnerId: a.ownerId, throughRank })).rejects.toThrow("atteint");
    expect((await t.run((ctx) => ctx.db.get(a.walletId)))!.diamonds).toBe(0);
  });

  it("credits card XP and emeralds atomically, without a duplicate reward on initialization or acknowledgment", async () => {
    const t = setup();
    const a = await player(t, "alice", 14);
    await t.run((ctx) => ctx.db.insert("collection", {
      ownerId: a.ownerId, variantId: "guardian:common", level: 1, copies: 100,
    }));
    await Promise.all([
      a.client.mutation(api.collection.upgrade, { variantId: "guardian:common" }),
      a.client.mutation(api.collection.ensureRank, { expectedOwnerId: a.ownerId }),
    ]);
    expect(await a.client.query(api.collection.rank, {})).toMatchObject({
      rank: 2, experience: 24, earned: 9,
      pending: { fromRank: 1, toRank: 2, emeralds: 3 },
    });
    await a.client.mutation(api.collection.acknowledgeRank, { expectedOwnerId: a.ownerId, throughRank: 2 });
    await a.client.mutation(api.collection.ensureRank, { expectedOwnerId: a.ownerId });
    expect((await a.client.query(api.collection.rank, {})).pending).toBeNull();
    expect((await t.run((ctx) => ctx.db.get(a.walletId)))!.diamonds).toBe(3);
  });

  it("resumes legacy ranks and totals all skipped rewards once, preserving a spent emerald balance", async () => {
    const t = setup();
    const a = await player(t, "alice", 120);
    expect((await a.client.query(api.collection.rank, {})).pending).toBeNull();
    await Promise.all([1, 2].map(() => a.client.mutation(api.collection.ensureRank, { expectedOwnerId: a.ownerId })));
    expect(await a.client.query(api.collection.rank, {})).toMatchObject({
      rank: 5, friends: 5, mineLevel: 1,
      pending: { fromRank: 1, toRank: 5, emeralds: 14 },
    });
    await a.client.mutation(api.collection.acknowledgeRank, { expectedOwnerId: a.ownerId, throughRank: 2 });
    expect((await a.client.query(api.collection.rank, {})).pending).toEqual({ fromRank: 2, toRank: 5, emeralds: 11 });
    await a.client.mutation(api.collection.acknowledgeRank, { expectedOwnerId: a.ownerId, throughRank: 5 });
    await a.client.mutation(api.collection.acknowledgeRank, { expectedOwnerId: a.ownerId, throughRank: 3 });
    expect((await a.client.query(api.collection.rank, {})).pending).toBeNull();
    expect((await t.run((ctx) => ctx.db.get(a.walletId)))!.diamonds).toBe(14);
  });

  it("projects old card XP consistently and settles legacy production at its former rate before migrating mines", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-27T10:00:00Z"));
    const t = setup();
    const a = await player(t, "legacy");
    const card = { variantId: "guardian:common", level: 6, copies: 0 };
    const expected = rankProgress(catalogueMigration([card]).experience);
    await t.run(async (ctx) => {
      await ctx.db.insert("collection", { ownerId: a.ownerId, ...card });
      const state = { heroLevel: 10, amount: 0, updatedAt: Date.now() - 8 * HOUR_MS, revision: 0 };
      await ctx.db.patch(a.walletId, { experience: undefined, catalogueVersion: undefined, mines: { gold: state, emeralds: state } });
    });
    expect((await a.client.query(api.collection.rank, {})).rank).toBe(expected.rank);
    await a.client.mutation(api.collection.ensureRank, { expectedOwnerId: a.ownerId });
    const first = await t.run((ctx) => ctx.db.get(a.walletId));
    expect(first!.experience).toBe(expected.experience);
    expect(first!.mines!.gold.amount).toBe(480);
    expect(first!.mines!.gold.heroLevel).toBeUndefined();
    expect(first!.mines!.gold.level).toBe((await a.client.query(api.collection.rank, {})).mineLevel);
    await a.client.mutation(api.collection.ensureRank, { expectedOwnerId: a.ownerId });
    expect(await t.run((ctx) => ctx.db.get(a.walletId))).toEqual(first);
    expect(await a.client.mutation(api.collection.collectMine, { kind: "gold", revision: 0, expectedOwnerId: a.ownerId })).toMatchObject({ amount: 480 });
  });

  it("awards sender XP once per friend and Paris day, including concurrent retries and re-added friends", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-27T22:59:00Z"));
    const t = setup();
    const a = await player(t, "alice", 149), b = await player(t, "bob", 120);
    await a.client.mutation(api.collection.ensureMines, {});
    await a.client.mutation(api.collection.acknowledgeRank, { expectedOwnerId: a.ownerId, throughRank: 5 });
    await a.client.mutation(api.social.request, { playerId: b.ownerId });
    await b.client.mutation(api.social.accept, { playerId: a.ownerId });
    const results = await Promise.all([1, 2].map(() => a.client.mutation(api.social.sendHelp, { playerId: b.ownerId })));
    expect(results.filter((result) => result.sent)).toHaveLength(1);
    expect(await a.client.query(api.collection.rank, {})).toMatchObject({
      rank: 6, experience: 150, mineLevel: 2,
      pending: { fromRank: 5, toRank: 6, emeralds: 3 },
    });
    expect((await b.client.query(api.collection.rank, {})).experience).toBe(120);
    expect(await b.client.query(api.social.balance, {})).toBe(10);
    expect((await t.run((ctx) => ctx.db.get(a.walletId)))!.diamonds).toBe(17);
    expect((await a.client.query(api.collection.mineBoard, { refreshKey: 0 })).mines!.gold.level).toBe(2);
    await a.client.mutation(api.social.remove, { playerId: b.ownerId });
    await a.client.mutation(api.social.request, { playerId: b.ownerId });
    await b.client.mutation(api.social.accept, { playerId: a.ownerId });
    expect(await a.client.mutation(api.social.sendHelp, { playerId: b.ownerId })).toMatchObject({ sent: false, experience: 0 });
    vi.setSystemTime(new Date("2026-10-27T23:00:00Z"));
    await a.client.mutation(api.social.sendHelp, { playerId: b.ownerId });
    expect((await a.client.query(api.collection.rank, {})).experience).toBe(151);
    expect(await b.client.query(api.social.balance, {})).toBe(20);
  });

  it("checks each player's rank allowance, unlocks more slots immediately and preserves older friendships", async () => {
    const t = setup();
    const a = await player(t, "alice", 149), b = await player(t, "bob", 120), locked = await player(t, "locked");
    expect(await locked.client.query(api.social.list, {})).toMatchObject({ limit: 0, nextUnlock: { rank: 5, friends: 5 } });
    await expect(locked.client.mutation(api.social.request, { playerId: b.ownerId })).rejects.toThrow("rang 5");
    await expect(b.client.mutation(api.social.request, { playerId: locked.ownerId })).rejects.toThrow("rang 5");
    await t.run(async (ctx) => {
      for (let i = 0; i < 5; i++) await ctx.db.insert("friendships", {
        ...friendshipPair(a.ownerId, `old-${i}`), requestedBy: a.ownerId, status: "accepted",
      });
    });
    await expect(b.client.mutation(api.social.request, { playerId: a.ownerId })).rejects.toThrow("déjà 5 amis");
    // A rank-10 player gets seven places, while the other side keeps its rank-5 cap.
    await t.run((ctx) => addRankExperience(ctx, a.ownerId, 201));
    expect((await a.client.query(api.social.list, {})).limit).toBe(7);
    await b.client.mutation(api.social.request, { playerId: a.ownerId });
    await a.client.mutation(api.social.accept, { playerId: b.ownerId });
    expect(await t.run((ctx) => ctx.db.query("friendships").collect())).toHaveLength(6);
  });
});
