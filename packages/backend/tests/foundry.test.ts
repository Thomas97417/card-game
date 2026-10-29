import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chestRules } from "@sylve/game/progression";
import { FOUNDRY, stepFoundry } from "@sylve/game/foundry";
import { api, components } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
function setup() { const t = convexTest(schema, modules); betterAuthTest.register(t); return t; }
type Test = ReturnType<typeof setup>;
async function player(t: Test, name: string) {
  const user = await t.mutation(components.betterAuth.adapter.create, { input: { model: "user", data: { name, email: `${name}@example.invalid`, emailVerified: true, createdAt: Date.now(), updatedAt: Date.now() } } });
  const session = await t.mutation(components.betterAuth.adapter.create, { input: { model: "session", data: { userId: user._id, token: `${name}-session`, createdAt: Date.now(), updatedAt: Date.now(), expiresAt: Date.now() + 90 * 86400000 } } });
  const client = t.withIdentity({ subject: user._id, sessionId: session._id });
  await client.mutation(api.foundry.ensure, { expectedOwnerId: user._id });
  return { client, ownerId: user._id };
}
async function begin(p: Awaited<ReturnType<typeof player>>, requestId = "round-1") {
  const b = await p.client.query(api.foundry.board, {});
  return p.client.mutation(api.foundry.startRound, { expectedOwnerId: p.ownerId, revision: b.progress!.revision, requestId, tool: "mallet", assistant: "smith" });
}
async function emptyRound(p: Awaited<ReturnType<typeof player>>, requestId: string) {
  const round = await begin(p, requestId);
  vi.setSystemTime(round.startedAt + 80000);
  for (let startTick = 0; startTick < 1000; startTick += 100)
    await p.client.mutation(api.foundry.submitInputs, { expectedOwnerId: p.ownerId, roundId: round._id, startTick, inputs: Array.from({ length: 100 }, () => ({ x: 0, z: 0, active: false })) });
  return round;
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-29T22:59:58Z")); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("la fonderie connectée", () => {
  it("requires authentication, initializes once, and checks owned assistants and permanent tool unlocks", async () => {
    const t = setup(); await expect(t.query(api.foundry.board, {})).rejects.toThrow("Connecte-toi");
    const alice = await player(t, "alice");
    await Promise.all([alice.client.mutation(api.foundry.ensure, { expectedOwnerId: alice.ownerId }), alice.client.mutation(api.foundry.ensure, { expectedOwnerId: alice.ownerId })]);
    expect(await t.run((ctx) => ctx.db.query("foundryProgress").collect())).toHaveLength(1);
    const board = await alice.client.query(api.foundry.board, {});
    expect(board.availableAssistants).toEqual(["smith", "dryad"]);
    await expect(alice.client.mutation(api.foundry.startRound, { expectedOwnerId: alice.ownerId, revision: 0, requestId: "locked", tool: "swift", assistant: "smith" })).rejects.toThrow("outil");
    await expect(alice.client.mutation(api.foundry.startRound, { expectedOwnerId: alice.ownerId, revision: 0, requestId: "locked-assistant", tool: "mallet", assistant: "feline" })).rejects.toThrow("compagnon");
    await expect(alice.client.mutation(api.foundry.ensure, { expectedOwnerId: "bob" })).rejects.toThrow("autre compte");
  });
  it("replays valid batches once, refuses time acceleration, divergent retries and cross-account writes", async () => {
    const t = setup(); const alice = await player(t, "alice"); const bob = await player(t, "bob");
    const round = await begin(alice);
    expect((await begin(alice))._id).toBe(round._id);
    const inputs = Array.from({ length: 40 }, () => ({ x: 0, z: 0, active: true }));
    const args = { expectedOwnerId: alice.ownerId, roundId: round._id, startTick: 0, inputs };
    await expect(alice.client.mutation(api.foundry.submitInputs, args)).rejects.toThrow("trop vite");
    vi.setSystemTime(Date.now() + 2000);
    const results = await Promise.all([alice.client.mutation(api.foundry.submitInputs, args), alice.client.mutation(api.foundry.submitInputs, args)]);
    expect(results[0]).toEqual(results[1]); expect(results[0]!.tick).toBe(40);
    await expect(alice.client.mutation(api.foundry.submitInputs, { ...args, inputs: inputs.map((i) => ({ ...i, x: 1 })) })).rejects.toThrow("autre onglet");
    await expect(alice.client.mutation(api.foundry.submitInputs, { ...args, startTick: 100 })).rejects.toThrow("changé");
    await expect(alice.client.mutation(api.foundry.submitInputs, { ...args, inputs: [{ x: 7, z: 0, active: true }] })).rejects.toThrow("invalide");
    await expect(bob.client.mutation(api.foundry.submitInputs, { ...args, expectedOwnerId: bob.ownerId })).rejects.toThrow("introuvable");
    await expect(alice.client.mutation(api.foundry.finishRound, { expectedOwnerId: alice.ownerId, roundId: round._id })).rejects.toThrow("terminée");
    expect((await alice.client.query(api.foundry.board, {})).round?.state).toEqual(results[0]);
  });
  it("replays moving relics exactly and can resume a persisted V1 round", async () => {
    const t = setup(); const alice = await player(t, "alice");
    const round = await begin(alice);
    expect(round.state.version).toBe(2);
    expect(round.state.targets.every((relic) => Math.hypot(relic.vx, relic.vz) > 0)).toBe(true);
    const inputs = Array.from({ length: 40 }, (_, i) => ({ x: Math.sin(i / 8) * 4, z: Math.cos(i / 9) * 2, active: true }));
    const expected = structuredClone(round.state); inputs.forEach((input) => stepFoundry(expected, input));
    vi.setSystemTime(Date.now() + 2000);
    const args = { expectedOwnerId: alice.ownerId, roundId: round._id, startTick: 0, inputs };
    expect(await alice.client.mutation(api.foundry.submitInputs, args)).toEqual(expected);
    expect(await alice.client.mutation(api.foundry.submitInputs, args)).toEqual(expected);
    const legacy = structuredClone(expected); legacy.version = 1;
    legacy.targets.forEach((relic) => { if (relic.kind !== "runner") { relic.vx = 0; relic.vz = 0; } });
    await t.run((ctx) => ctx.db.patch(round._id, { state: legacy }));
    const resumed = structuredClone(legacy); inputs.forEach((input) => stepFoundry(resumed, input));
    vi.setSystemTime(Date.now() + 2000);
    expect(await alice.client.mutation(api.foundry.submitInputs, { ...args, startTick: 40 })).toEqual(resumed);
  });
  it("settles each round once, closes an unfunded chantier, and preserves permanent mastery on restart", async () => {
    const t = setup(); const alice = await player(t, "alice");
    const first = await emptyRound(alice, "first");
    const args = { expectedOwnerId: alice.ownerId, roundId: first._id };
    await Promise.all([alice.client.mutation(api.foundry.finishRound, args), alice.client.mutation(api.foundry.finishRound, args)]);
    let board = await alice.client.query(api.foundry.board, {});
    expect(board.progress?.cycle.roundsLeft).toBe(1); expect(board.round).toBeNull();
    const second = await emptyRound(alice, "second"); await alice.client.mutation(api.foundry.finishRound, { ...args, roundId: second._id });
    board = await alice.client.query(api.foundry.board, {}); expect(board.progress?.cycle.status).toBe("failed");
    await t.run((ctx) => ctx.db.patch(board.progress!._id, { mastery: 3 }));
    await alice.client.mutation(api.foundry.newChantier, { expectedOwnerId: alice.ownerId, revision: board.progress!.revision });
    board = await alice.client.query(api.foundry.board, {}); expect(board.progress).toMatchObject({ mastery: 3, cycle: { number: 2, orderIndex: 0, shards: 0, status: "active" } });
    await alice.client.mutation(api.foundry.startRound, { expectedOwnerId: alice.ownerId, revision: board.progress!.revision, requestId: "permanent-tool", tool: "resonance", assistant: "dryad" });
  });
  it("credits exactly one real common chest after three deliveries, persists its reveal, and resets at Paris midnight", async () => {
    const t = setup(); const alice = await player(t, "alice");
    let board = await alice.client.query(api.foundry.board, {});
    await t.run(async (ctx) => {
      await ctx.db.patch(board.progress!._id, { cycle: { ...board.progress!.cycle, shards: 9000 } });
      await ctx.db.insert("leagueProgress", { ownerId: alice.ownerId, trophies: 0, peakTrophies: 1000 });
    });
    async function delivery() {
      board = await alice.client.query(api.foundry.board, {});
      const args = { expectedOwnerId: alice.ownerId, revision: board.progress!.revision, cycleNumber: board.progress!.cycle.number, orderIndex: board.progress!.cycle.orderIndex };
      await Promise.all([alice.client.mutation(api.foundry.payOrder, args), alice.client.mutation(api.foundry.payOrder, args)]);
      board = await alice.client.query(api.foundry.board, {});
      await alice.client.mutation(api.foundry.chooseBlessing, { expectedOwnerId: alice.ownerId, revision: board.progress!.revision, blessing: board.progress!.cycle.choices[0]! });
      board = await alice.client.query(api.foundry.board, {});
    }
    await delivery(); await delivery(); expect(board.daily.delivered).toBe(2); expect(board.pendingReward).toBeNull();
    await delivery(); expect(board.daily.claimed).toBe(true); expect(board.progress!.mastery).toBe(3);
    const receipt = board.pendingReward!; expect(receipt.receipt!.reveals.length).toBeGreaterThan(0);
    const rule = chestRules("common", 1000);
    expect(receipt.receipt!.gold).toBeGreaterThanOrEqual(rule.minGold); expect(receipt.receipt!.gold).toBeLessThanOrEqual(rule.maxGold);
    const gold = await alice.client.query(api.collection.gold, {});
    expect(gold).toBe(receipt.receipt!.gold);
    expect((await alice.client.query(api.missions.board, { refreshKey: "test" })).daily.missions.find((m) => m.id === "daily-chest")?.progress).toBeGreaterThanOrEqual(1);
    await delivery(); expect(await alice.client.query(api.collection.gold, {})).toBe(gold);
    expect((await alice.client.query(api.foundry.board, {})).pendingReward?._id).toBe(receipt._id);
    const bob = await player(t, "bob");
    await expect(bob.client.mutation(api.foundry.acknowledgeReward, { expectedOwnerId: bob.ownerId, rewardId: receipt._id })).rejects.toThrow("introuvable");
    await alice.client.mutation(api.foundry.acknowledgeReward, { expectedOwnerId: alice.ownerId, rewardId: receipt._id });
    vi.setSystemTime(new Date("2026-10-29T23:00:01Z"));
    board = await alice.client.query(api.foundry.board, {}); expect(board.daily).toMatchObject({ day: "2026-10-30", delivered: 0, claimed: false });
    await delivery(); expect(board.daily.delivered).toBe(1);
    await alice.client.mutation(api.foundry.newChantier, { expectedOwnerId: alice.ownerId, revision: board.progress!.revision });
    board = await alice.client.query(api.foundry.board, {});
    await t.run((ctx) => ctx.db.patch(board.progress!._id, { cycle: { ...board.progress!.cycle, shards: 9000 } }));
    await delivery(); await delivery(); expect(board.daily.claimed).toBe(true);
    expect(await t.run((ctx) => ctx.db.query("foundryDaily").collect())).toHaveLength(2);
  });
  it("rejects stale purchases and decisions while a round is active", async () => {
    const t = setup(); const alice = await player(t, "alice"); let board = await alice.client.query(api.foundry.board, {});
    await t.run((ctx) => ctx.db.patch(board.progress!._id, { cycle: { ...board.progress!.cycle, shards: 500 } }));
    await alice.client.mutation(api.foundry.purchaseUpgrade, { expectedOwnerId: alice.ownerId, revision: 0, upgrade: "power" });
    await expect(alice.client.mutation(api.foundry.purchaseUpgrade, { expectedOwnerId: alice.ownerId, revision: 0, upgrade: "power" })).rejects.toThrow("changé");
    await begin(alice); board = await alice.client.query(api.foundry.board, {});
    await expect(alice.client.mutation(api.foundry.payOrder, { expectedOwnerId: alice.ownerId, revision: board.progress!.revision, cycleNumber: 1, orderIndex: 0 })).rejects.toThrow("manche en cours");
    expect(board.progress!.cycle.shards).toBe(500 - FOUNDRY.upgradeCosts[0]);
  });
});
