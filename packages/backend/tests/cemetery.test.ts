import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CEMETERY,
  createCemeteryRun,
  cemeteryStats,
  offerCemeteryLevel,
  stepCemetery,
  type CemeteryRun,
} from "@sylve/game/cemetery";
import { api, components } from "../convex/_generated/api";
import schema from "../convex/schema";
const modules = import.meta.glob("../convex/**/*.ts");
function setup() {
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
  return t;
}
type Test = ReturnType<typeof setup>;
async function player(t: Test, name = "alice") {
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
        expiresAt: Date.now() + 86400000,
      },
    },
  });
  const client = t.withIdentity({ subject: user._id, sessionId: session._id }),
    ownerId = user._id;
  await client.mutation(api.cemetery.ensure, { expectedOwnerId: ownerId });
  return { client, ownerId };
}
type Player = Awaited<ReturnType<typeof player>>;
async function start(p: Player, requestId = "run-1") {
  const b = await p.client.query(api.cemetery.board, {});
  return p.client.mutation(api.cemetery.startRun, {
    expectedOwnerId: p.ownerId,
    revision: b.progress!.revision,
    requestId,
    leaseId: "lease-1",
  });
}
async function fund(t: Test, p: Player, gold = 100000, diamonds = 1000) {
  await t.run(async (ctx) => {
    const w = await ctx.db
      .query("wallets")
      .withIndex("by_owner", (q) => q.eq("ownerId", p.ownerId))
      .unique();
    await ctx.db.patch(w!._id, { gold, diamonds });
  });
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-12T12:00:00Z"));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe("le cimetière connecté", () => {
  it("requires a session and the current owner for every account mutation", async () => {
    const t = setup(),
      alice = await player(t),
      bob = await player(t, "bob"),
      run = await start(alice);
    await expect(t.query(api.cemetery.board, {})).rejects.toThrow();
    await expect(
      bob.client.query(api.cemetery.run, { runId: run._id }),
    ).rejects.toThrow("introuvable");
    await expect(
      bob.client.mutation(api.cemetery.abandonRun, {
        expectedOwnerId: alice.ownerId,
        runId: run._id,
      }),
    ).rejects.toThrow("autre compte");
    await expect(
      bob.client.mutation(api.cemetery.openReward, {
        expectedOwnerId: bob.ownerId,
        runId: run._id,
      }),
    ).rejects.toThrow("introuvable");
  });
  it("initializes once, snapshots the selected hero and upgrades, and deduplicates start requests", async () => {
    const t = setup(),
      p = await player(t);
    await fund(t, p);
    await p.client.mutation(api.cemetery.ensure, {
      expectedOwnerId: p.ownerId,
    });
    for (const rank of [0, 1, 2])
      await p.client.mutation(api.cemetery.purchaseUpgrade, {
        expectedOwnerId: p.ownerId,
        upgrade: "health",
        expectedRank: rank,
        currency: "gold",
      });
    await t.run(async (ctx) => {
      const h = await ctx.db
        .query("heroes")
        .withIndex("by_owner", (q) => q.eq("ownerId", p.ownerId))
        .unique();
      await ctx.db.patch(h!._id, { selectedHeroId: "moon", level: 50 });
    });
    const run = await start(p);
    expect(run.state.heroId).toBe("moon");
    expect(run.state.health).toBeCloseTo(133.1);
    expect(await start(p)).toEqual(run);
    await expect(start(p, "other-run")).rejects.toThrow("Reprends");
    await expect(
      p.client.mutation(api.cemetery.purchaseUpgrade, {
        expectedOwnerId: p.ownerId,
        upgrade: "armor",
        expectedRank: 0,
        currency: "gold",
      }),
    ).rejects.toThrow("Termine");
    expect(cemeteryStats(run.state as CemeteryRun).maxHealth).toBeCloseTo(
      133.1,
    );
  });
  it("buys the same rank once across currencies, rejects insufficient funds and preserves a spent zero", async () => {
    const t = setup(),
      p = await player(t);
    await fund(t, p, 0, 0);
    const purchase = {
      expectedOwnerId: p.ownerId,
      upgrade: "shield" as const,
      expectedRank: 0,
    };
    await expect(
      p.client.mutation(api.cemetery.purchaseUpgrade, {
        ...purchase,
        currency: "gold",
      }),
    ).rejects.toThrow("assez d’or");
    await expect(
      p.client.mutation(api.cemetery.purchaseUpgrade, {
        ...purchase,
        currency: "emeralds",
      }),
    ).rejects.toThrow("assez d’émeraudes");
    await fund(t, p, 600, 3);
    await Promise.all([
      p.client.mutation(api.cemetery.purchaseUpgrade, {
        ...purchase,
        currency: "gold",
      }),
      p.client.mutation(api.cemetery.purchaseUpgrade, {
        ...purchase,
        currency: "emeralds",
      }),
    ]);
    let b = await p.client.query(api.cemetery.board, {});
    expect(b.progress!.upgrades.shield).toBe(1);
    expect((600 - b.gold) / 600 + (3 - b.emeralds) / 3).toBe(1);
    const balance = { gold: b.gold, emeralds: b.emeralds };
    await p.client.mutation(api.cemetery.purchaseUpgrade, {
      ...purchase,
      currency: "gold",
    });
    b = await p.client.query(api.cemetery.board, {});
    expect({ gold: b.gold, emeralds: b.emeralds }).toEqual(balance);
    await fund(t, p);
    for (const rank of [1, 2, 3, 4])
      await p.client.mutation(api.cemetery.purchaseUpgrade, {
        ...purchase,
        expectedRank: rank,
        currency: "emeralds",
      });
    await expect(
      p.client.mutation(api.cemetery.purchaseUpgrade, {
        ...purchase,
        expectedRank: 5,
        currency: "gold",
      }),
    ).rejects.toThrow("maximum");
  });
  it("recomputes inputs, enforces pacing and makes exact batch retries idempotent", async () => {
    const t = setup(),
      p = await player(t),
      run = await start(p),
      inputs = Array.from({ length: 20 }, () => ({ x: 1000, y: 0 }));
    const args = {
      expectedOwnerId: p.ownerId,
      runId: run._id,
      leaseId: "lease-1",
      startTick: 0,
      inputs,
    };
    await expect(
      p.client.mutation(api.cemetery.submitInputs, args),
    ).rejects.toThrow("trop vite");
    vi.advanceTimersByTime(1000);
    const expected = structuredClone(run.state) as CemeteryRun;
    inputs.forEach((i) => stepCemetery(expected, i));
    expect(await p.client.mutation(api.cemetery.submitInputs, args)).toEqual({
      state: expected,
      acceptedTick: 20,
    });
    expect(await p.client.mutation(api.cemetery.submitInputs, args)).toEqual({
      state: expected,
      acceptedTick: 20,
    });
    await expect(
      p.client.mutation(api.cemetery.submitInputs, {
        ...args,
        inputs: inputs.map(() => ({ x: -1000, y: 0 })),
      }),
    ).rejects.toThrow("autre onglet");
    await expect(
      p.client.mutation(api.cemetery.submitInputs, {
        ...args,
        startTick: 20,
        inputs: [{ x: 1001, y: 0 }],
      }),
    ).rejects.toThrow("invalide");
    await expect(
      p.client.mutation(api.cemetery.submitInputs, {
        ...args,
        startTick: 20,
        inputs: Array.from({ length: 41 }, () => ({ x: 0, y: 0 })),
      }),
    ).rejects.toThrow("invalide");
  });
  it("freezes checkpoints while paused and invalidates an old tab on explicit resume", async () => {
    const t = setup(),
      p = await player(t),
      run = await start(p),
      args = { expectedOwnerId: p.ownerId, runId: run._id };
    await p.client.mutation(api.cemetery.pauseRun, {
      ...args,
      leaseId: "lease-1",
    });
    vi.advanceTimersByTime(3600000);
    expect(
      (await p.client.query(api.cemetery.run, { runId: run._id })).state.tick,
    ).toBe(0);
    await p.client.mutation(api.cemetery.resumeRun, {
      ...args,
      leaseId: "lease-2",
    });
    const batch = {
      ...args,
      startTick: 0,
      inputs: Array.from({ length: 20 }, () => ({ x: 0, y: 0 })),
    };
    await expect(
      p.client.mutation(api.cemetery.submitInputs, {
        ...batch,
        leaseId: "lease-1",
      }),
    ).rejects.toThrow("changé");
    await expect(
      p.client.mutation(api.cemetery.submitInputs, {
        ...batch,
        leaseId: "lease-2",
      }),
    ).rejects.toThrow("trop vite");
    vi.advanceTimersByTime(1000);
    expect(
      (
        await p.client.mutation(api.cemetery.submitInputs, {
          ...batch,
          leaseId: "lease-2",
        })
      ).state.tick,
    ).toBe(20);
  });
  it("saves level choices, accepts only offered options and deduplicates the chosen upgrade", async () => {
    const t = setup(),
      p = await player(t),
      run = await start(p),
      state = structuredClone(run.state) as CemeteryRun;
    state.xp = 5;
    offerCemeteryLevel(state);
    await t.run((ctx) => ctx.db.patch(run._id, { state, leasePaused: true }));
    const args = {
      expectedOwnerId: p.ownerId,
      runId: run._id,
      leaseId: "lease-1",
      serial: state.choiceSerial,
    };
    await expect(
      p.client.mutation(api.cemetery.chooseUpgrade, {
        ...args,
        choice: "illegal",
      }),
    ).rejects.toThrow("disponible");
    const first = await p.client.mutation(api.cemetery.chooseUpgrade, {
      ...args,
      choice: state.choices[0]!,
    });
    expect(first.state.choices).toEqual([]);
    expect(
      (
        await p.client.mutation(api.cemetery.chooseUpgrade, {
          ...args,
          choice: state.choices[0]!,
        })
      ).state,
    ).toEqual(first.state);
    await expect(
      p.client.mutation(api.cemetery.chooseUpgrade, {
        ...args,
        choice: state.choices[1]!,
      }),
    ).rejects.toThrow("déjà");
  });
  it("awards each duration tier without a daily quota and opens each reward exactly once", async () => {
    const t = setup(),
      p = await player(t);
    await fund(t, p, 0, 0);
    for (const [i, seconds] of [10, 300, 600, 900, 1200].entries()) {
      const run = await start(p, `death-${i}`),
        state = createCemeteryRun(17);
      state.tick = seconds * 20;
      state.health = 0;
      state.ended = true;
      state.gold = 19;
      await t.run((ctx) => ctx.db.patch(run._id, { state }));
      const args = { expectedOwnerId: p.ownerId, runId: run._id };
      const summary = await p.client.mutation(api.cemetery.finishRun, args);
      expect(summary.rarity).toBe(
        ["common", "rare", "bigRare", "epic", "legendary"][i],
      );
      expect(await p.client.mutation(api.cemetery.finishRun, args)).toEqual(
        summary,
      );
      const b = await p.client.query(api.cemetery.board, {});
      expect(b.pendingRewards.some((r) => r.id === run._id)).toBe(true);
      const reward = await p.client.mutation(api.cemetery.openReward, args);
      expect(reward.gold).toBeGreaterThanOrEqual(19);
      expect(reward.reveals.length).toBeGreaterThan(0);
      const balance = (await p.client.query(api.cemetery.board, {})).gold;
      const inventory = await t.run((ctx) =>
        ctx.db
          .query("collection")
          .withIndex("by_owner_variant", (q) => q.eq("ownerId", p.ownerId))
          .collect(),
      );
      expect(await p.client.mutation(api.cemetery.openReward, args)).toEqual(
        reward,
      );
      expect((await p.client.query(api.cemetery.board, {})).gold).toBe(balance);
      expect(
        await t.run((ctx) =>
          ctx.db
            .query("collection")
            .withIndex("by_owner_variant", (q) => q.eq("ownerId", p.ownerId))
            .collect(),
        ),
      ).toEqual(inventory);
    }
    const b = await p.client.query(api.cemetery.board, {});
    expect(b.progress).toMatchObject({ runs: 5, bestSeconds: 1200 });
    expect(b.pendingRewards).toEqual([]);
  });
  it("does not finalize a living run or reward an abandoned one", async () => {
    const t = setup(),
      p = await player(t),
      run = await start(p),
      args = { expectedOwnerId: p.ownerId, runId: run._id };
    const before = await p.client.query(api.cemetery.board, {});
    await expect(
      p.client.mutation(api.cemetery.finishRun, args),
    ).rejects.toThrow("pas terminée");
    await p.client.mutation(api.cemetery.abandonRun, args);
    await p.client.mutation(api.cemetery.abandonRun, args);
    await expect(
      p.client.mutation(api.cemetery.openReward, args),
    ).rejects.toThrow("disponible");
    const b = await p.client.query(api.cemetery.board, {});
    expect(b.activeRun).toBeNull();
    expect(b.pendingRewards).toEqual([]);
    expect(b.gold).toBe(before.gold);
    expect(b.progress!.runs).toBe(0);
  });
});
