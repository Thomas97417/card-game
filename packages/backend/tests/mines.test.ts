import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOUR_MS, type MineKind } from "@sylve/game/mines";
import { api, components } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const startedAt = Date.UTC(2026, 9, 25, 8);
function setup() {
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
  return t;
}
async function player(t: ReturnType<typeof setup>, name = "alice") {
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
        expiresAt: Date.now() + HOUR_MS * 24,
      },
    },
  });
  return {
    userId: user._id,
    client: t.withIdentity({ subject: user._id, sessionId: session._id }),
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(startedAt);
});
afterEach(() => vi.useRealTimers());

describe("collecte des mines côté serveur", () => {
  it("requires authentication and rejects forged collection arguments", async () => {
    const t = setup();
    await expect(t.query(api.collection.mineBoard, { refreshKey: 0 })).rejects.toThrow("Connecte-toi");
    await expect(t.mutation(api.collection.ensureMines, {})).rejects.toThrow("Connecte-toi");
    await expect(t.mutation(api.collection.collectMine, { kind: "gold", revision: 0 })).rejects.toThrow("Connecte-toi");
    const { client } = await player(t);
    await client.mutation(api.collection.ensureMines, {});
    await expect(client.mutation(api.collection.collectMine, { kind: "gold", revision: -1 })).rejects.toThrow("invalide");
    await expect(client.mutation(api.collection.collectMine, {
      kind: "gold", revision: 0, amount: 999999, now: startedAt + HOUR_MS * 9,
    } as { kind: MineKind; revision: number })).rejects.toThrow();
    await expect(client.mutation(api.collection.collectMine, { kind: "forged" as MineKind, revision: 0 })).rejects.toThrow();
    expect(await client.query(api.collection.gold, {})).toBe(0);
  });

  it("starts once, survives reloads, preserves wallets and credits both currencies independently", async () => {
    const t = setup();
    const { client, userId } = await player(t);
    await t.run((ctx) => ctx.db.insert("wallets", {
      ownerId: userId, gold: 725, diamonds: 0, experience: 0, soulDust: 9, catalogueVersion: 2,
    }));
    await Promise.all([
      client.mutation(api.collection.ensureMines, {}),
      client.mutation(api.collection.ensureMines, {}),
    ]);
    vi.setSystemTime(startedAt + HOUR_MS);
    await client.mutation(api.collection.ensureMines, {});
    const board = await client.query(api.collection.mineBoard, { refreshKey: -999999 });
    expect(board.mines!.gold.updatedAt).toBe(startedAt);
    expect(await client.mutation(api.collection.collectMine, { kind: "gold", revision: 0 })).toMatchObject({ amount: 6 });
    expect(await client.query(api.collection.gold, {})).toBe(731);
    expect(await client.query(api.collection.diamonds, {})).toBe(0);
    expect(await client.mutation(api.collection.collectMine, { kind: "emeralds", revision: 0 })).toMatchObject({ amount: 2 });
    expect(await client.query(api.collection.diamonds, {})).toBe(2);
    const wallet = await t.run((ctx) => ctx.db.query("wallets").unique());
    expect(wallet).toMatchObject({ soulDust: 9, experience: 0 });
  });

  it("caps long offline production and discards overflow before restarting", async () => {
    const t = setup();
    const { client } = await player(t);
    await client.mutation(api.collection.ensureMines, {});
    const initialEmeralds = await client.query(api.collection.diamonds, {});
    vi.setSystemTime(startedAt + HOUR_MS * 12);
    expect(await client.mutation(api.collection.collectMine, { kind: "gold", revision: 0 })).toMatchObject({ amount: 48 });
    expect(await client.mutation(api.collection.collectMine, { kind: "emeralds", revision: 0 })).toMatchObject({ amount: 16 });
    vi.setSystemTime(startedAt + HOUR_MS * 13);
    expect(await client.mutation(api.collection.collectMine, { kind: "gold", revision: 1 })).toMatchObject({ amount: 6 });
    expect(await client.query(api.collection.diamonds, {})).toBe(initialEmeralds + 16);
  });

  it("deduplicates simultaneous collections, stale retries and requests across tabs", async () => {
    const t = setup();
    const { client } = await player(t);
    await client.mutation(api.collection.ensureMines, {});
    vi.setSystemTime(startedAt + HOUR_MS);
    const request = { kind: "gold", revision: 0 } as const;
    const results = await Promise.all([
      client.mutation(api.collection.collectMine, request),
      client.mutation(api.collection.collectMine, request),
    ]);
    expect(results.map((result) => result.amount).sort((a, b) => a - b)).toEqual([0, 6]);
    vi.setSystemTime(startedAt + HOUR_MS * 2);
    expect(await client.mutation(api.collection.collectMine, request)).toMatchObject({ amount: 0, alreadyCollected: true });
    expect(await client.query(api.collection.gold, {})).toBe(6);
    expect(await client.mutation(api.collection.collectMine, { ...request, revision: 1 })).toMatchObject({ amount: 6 });
  });

  it("retains fractional production and leaves an empty collection untouched", async () => {
    const t = setup();
    const { client } = await player(t);
    await client.mutation(api.collection.ensureMines, {});
    vi.setSystemTime(startedAt + 750_000);
    expect(await client.mutation(api.collection.collectMine, { kind: "gold", revision: 0 })).toMatchObject({ amount: 1 });
    vi.setSystemTime(startedAt + HOUR_MS / 4);
    expect(await client.mutation(api.collection.collectMine, { kind: "emeralds", revision: 0 })).toMatchObject({ amount: 0 });
    vi.setSystemTime(startedAt + 1_200_000);
    expect(await client.mutation(api.collection.collectMine, { kind: "gold", revision: 1 })).toMatchObject({ amount: 1 });
    vi.setSystemTime(startedAt + HOUR_MS / 2);
    expect(await client.mutation(api.collection.collectMine, { kind: "emeralds", revision: 0 })).toMatchObject({ amount: 1 });
  });

  it("uses the Guardian level and applies a promotion prospectively", async () => {
    const t = setup();
    const { client, userId } = await player(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("wallets", {
        ownerId: userId, gold: 100000, diamonds: 0, experience: 1000, catalogueVersion: 2,
      });
      await ctx.db.insert("heroes", { ownerId: userId, level: 1, peakMight: 10000 });
      await ctx.db.insert("collection", { ownerId: userId, variantId: "guardian:common", level: 1, copies: 1000 });
    });
    await client.mutation(api.collection.ensureMines, {});
    vi.setSystemTime(startedAt + HOUR_MS);
    await client.mutation(api.collection.upgrade, { variantId: "guardian:common" });
    expect((await client.query(api.collection.mineBoard, { refreshKey: 1 })).heroLevel).toBe(1);
    await client.mutation(api.collection.upgradeHero, { expectedLevel: 1 });
    const board = await client.query(api.collection.mineBoard, { refreshKey: 0 });
    expect(board.heroLevel).toBe(2);
    expect(board.mines!.gold).toMatchObject({ amount: 6, heroLevel: 2 });
    expect(board.mines!.emeralds).toMatchObject({ amount: 2, heroLevel: 2 });
    vi.setSystemTime(startedAt + HOUR_MS * 2);
    expect(await client.mutation(api.collection.collectMine, { kind: "gold", revision: 0 })).toMatchObject({ amount: 18 });
  });

  it("keeps each player's production private and balances isolated", async () => {
    const t = setup();
    const alice = await player(t);
    const bob = await player(t, "bob");
    await alice.client.mutation(api.collection.ensureMines, {});
    vi.setSystemTime(startedAt + HOUR_MS);
    await bob.client.mutation(api.collection.ensureMines, {});
    expect(await bob.client.mutation(api.collection.collectMine, { kind: "gold", revision: 0 })).toMatchObject({ amount: 0 });
    expect(await alice.client.mutation(api.collection.collectMine, { kind: "gold", revision: 0 })).toMatchObject({ amount: 6 });
    expect(await bob.client.query(api.collection.gold, {})).toBe(0);
  });
});
