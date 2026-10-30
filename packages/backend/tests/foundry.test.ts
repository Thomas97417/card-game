import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chestRules } from "@sylve/game/progression";
import { FOUNDRY, LEGACY_TOOLS as TOOLS, TOOL_IDS, foundryToolDefinition, FOUNDRY_SKILL_IDS, FOUNDRY_CHARM_IDS, createFoundryRound, foundryStats, newFoundryCycle, stepFoundry } from "@sylve/game/foundry";
import { api, components } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
function setup() { const t = convexTest(schema, modules); betterAuthTest.register(t); return t; }
type Test = ReturnType<typeof setup>;
async function player(t: Test, name: string, modern = false) {
  const user = await t.mutation(components.betterAuth.adapter.create, { input: { model: "user", data: { name, email: `${name}@example.invalid`, emailVerified: true, createdAt: Date.now(), updatedAt: Date.now() } } });
  const session = await t.mutation(components.betterAuth.adapter.create, { input: { model: "session", data: { userId: user._id, token: `${name}-session`, createdAt: Date.now(), updatedAt: Date.now(), expiresAt: Date.now() + 90 * 86400000 } } });
  const client = t.withIdentity({ subject: user._id, sessionId: session._id });
  await client.mutation(api.foundry.ensure, { expectedOwnerId: user._id });
  const saved = await client.query(api.foundry.board, {});
  if (!modern) await t.run((ctx) => ctx.db.patch(saved.progress!._id, { cycle: { ...saved.progress!.cycle, economy: 2 } }));
  return { client, ownerId: user._id };
}
async function begin(p: Awaited<ReturnType<typeof player>>, requestId = "round-1") {
  const b = await p.client.query(api.foundry.board, {});
  return p.client.mutation(api.foundry.startRound, { expectedOwnerId: p.ownerId, revision: b.progress!.revision, requestId, tool: "mallet", assistant: "smith" });
}
async function emptyRound(p: Awaited<ReturnType<typeof player>>, requestId: string) {
  const round = await begin(p, requestId);
  let state = round.state;
  while (!state.ended) {
    vi.setSystemTime(round.startedAt + (state.tick + 100) * FOUNDRY.stepMs);
    state = await p.client.mutation(api.foundry.submitInputs, { expectedOwnerId: p.ownerId, roundId: round._id, startTick: state.tick, inputs: Array.from({ length: 100 }, () => ({ x: 5.6, z: 3.4, active: false })) });
  }
  return round;
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-29T22:59:58Z")); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("la fonderie connectée", () => {
  it("initializes the reference economy and authoritatively buys and replays every source hammer", async () => {
    const t = setup();
    for (const tool of TOOL_IDS.filter((id) => id !== "mallet")) {
      const p = await player(t, `source-${tool}`, true), board = await p.client.query(api.foundry.board, {});
      expect(board.progress!.cycle.economy).toBe(3);
      const spec = foundryToolDefinition(board.progress!.cycle, tool);
      await t.run((ctx) => ctx.db.patch(board.progress!._id, { mastery: 500, cycle: { ...board.progress!.cycle, shards: spec.cost } }));
      await p.client.mutation(api.foundry.purchaseTool, { expectedOwnerId: p.ownerId, revision: 0, tool });
      expect((await p.client.query(api.foundry.board, {})).progress!.cycle.shards).toBe(0);
      const round = await p.client.mutation(api.foundry.startRound, { expectedOwnerId: p.ownerId, revision: 1, requestId: `reference-${tool}`, tool, assistant: "smith" });
      expect(round.state.version).toBe(9); expect(round.state.stats.damage).toBe(spec.damage); expect(round.state.stats.stamina).toBe(spec.stamina);
      expect(round.state.rogue!.wealth).toBe(10);
      const expected = structuredClone(round.state), inputs = [];
      for (let i = 0; i < 40; i++) { const target = expected.targets.reduce((a, b) => a.hp < b.hp ? a : b), input = { x: target.x, z: target.z, active: true }; inputs.push(input); stepFoundry(expected, input); }
      vi.setSystemTime(round.startedAt + 2000);
      const args = { expectedOwnerId: p.ownerId, roundId: round._id, startTick: 0, inputs };
      expect(await p.client.mutation(api.foundry.submitInputs, args)).toEqual(expected);
      expect(await p.client.mutation(api.foundry.submitInputs, args)).toEqual(expected);
    }
  });
  it("replays high-value relics and limited recovery identically over several saved batches", async () => {
    const t = setup(), p = await player(t, "endgame", true), board = await p.client.query(api.foundry.board, {});
    await t.run((ctx) => ctx.db.patch(board.progress!._id, { cycle: { ...board.progress!.cycle, orderIndex: 4, shards: 10000000,
      skills: FOUNDRY_SKILL_IDS, blessings: ["recovery", "efficient", "berserk", "power"] } }));
    await p.client.mutation(api.foundry.purchaseTool, { expectedOwnerId: p.ownerId, revision: 0, tool: "gilded" });
    const round = await p.client.mutation(api.foundry.startRound, { expectedOwnerId: p.ownerId, revision: 1, requestId: "final-deposit", tool: "gilded", assistant: "smith" });
    expect(round.state.rogue).toMatchObject({ pressure: 90, wealth: 14000, recoveryReserve: 0 });
    const expected = structuredClone(round.state);
    for (let startTick = 0; startTick < 320; startTick += 40) {
      const inputs = [];
      for (let i = 0; i < 40; i++) { const t = expected.targets.reduce((a, b) => a.hp < b.hp ? a : b), input = { x: t.x, z: t.z, active: true }; inputs.push(input); stepFoundry(expected, input); }
      vi.setSystemTime(round.startedAt + (startTick + 40) * FOUNDRY.stepMs);
      const args = { expectedOwnerId: p.ownerId, roundId: round._id, startTick, inputs };
      expect(await p.client.mutation(api.foundry.submitInputs, args)).toEqual(expected); expect(await p.client.mutation(api.foundry.submitInputs, args)).toEqual(expected);
    }
    expect(expected.shards).toBeGreaterThan(10000); expect(expected.rogue!.recoveryReserve).toBeGreaterThanOrEqual(0);
  });
  it("moves a closed legacy chantier to the new economy without carrying cheap hammer purchases", async () => {
    const t = setup(), p = await player(t, "migration"), board = await p.client.query(api.foundry.board, {});
    await t.run((ctx) => ctx.db.patch(board.progress!._id, { mastery: 3, cycle: { ...board.progress!.cycle, shards: 5000, purchasedTools: ["heavy"], selectedTool: "heavy" } }));
    await p.client.mutation(api.foundry.abandonChantier, { expectedOwnerId: p.ownerId, revision: 0 });
    await p.client.mutation(api.foundry.newChantier, { expectedOwnerId: p.ownerId, revision: 1 });
    const fresh = await p.client.query(api.foundry.board, {});
    expect(fresh.progress).toMatchObject({ mastery: 3, cycle: { economy: 3, shards: 0, selectedTool: "mallet", purchasedTools: [] } });
    await expect(p.client.mutation(api.foundry.purchaseTool, { expectedOwnerId: p.ownerId, revision: 2, tool: "heavy" })).rejects.toThrow("éclats");
  });
  it("requires buying swift and resonance even with high mastery and funds them with run shards", async () => {
    const t = setup(), p = await player(t, "master"); let board = await p.client.query(api.foundry.board, {});
    await t.run((ctx) => ctx.db.patch(board.progress!._id, { mastery: 500, cycle: { ...board.progress!.cycle, shards: 400 } }));
    for (const tool of ["swift", "resonance"] as const) {
      await expect(p.client.mutation(api.foundry.startRound, { expectedOwnerId: p.ownerId, revision: 0, requestId: `unpaid-${tool}`, tool, assistant: "smith" })).rejects.toThrow("acheté");
      await expect(p.client.mutation(api.foundry.equipTool, { expectedOwnerId: p.ownerId, revision: 0, tool })).rejects.toThrow("acheté");
    }
    await p.client.mutation(api.foundry.purchaseTool, { expectedOwnerId: p.ownerId, revision: 0, tool: "swift" });
    await p.client.mutation(api.foundry.purchaseTool, { expectedOwnerId: p.ownerId, revision: 1, tool: "resonance" });
    board = await p.client.query(api.foundry.board, {});
    expect(board.progress).toMatchObject({ mastery: 500, masterySpent: 0, revision: 2, cycle: { shards: 20, purchasedTools: ["swift", "resonance"], selectedTool: "resonance" } });
    const round = await p.client.mutation(api.foundry.startRound, { expectedOwnerId: p.ownerId, revision: 2, requestId: "paid-resonance", tool: "resonance", assistant: "smith" });
    expect(round.state.tool).toBe("resonance");
  });
  it("finishes an already active legacy swift round without granting a free hammer for the next round", async () => {
    const t = setup(), p = await player(t, "legacy"), round = await begin(p);
    const board = await p.client.query(api.foundry.board, {}), initial = createFoundryRound(91, board.progress!.cycle, "swift", "smith");
    await t.run(async (ctx) => {
      await ctx.db.patch(round._id, { state: initial });
      await ctx.db.patch(board.progress!._id, { mastery: 500, cycle: { ...board.progress!.cycle, selectedTool: "swift", purchasedTools: undefined } });
    });
    const expected = structuredClone(initial), inputs = Array.from({ length: 40 }, () => ({ x: 5.6, z: 3.4, active: false }));
    while (!expected.ended) {
      const startTick = expected.tick; inputs.forEach((input) => stepFoundry(expected, input));
      vi.setSystemTime(round.startedAt + (startTick + 40) * FOUNDRY.stepMs);
      expect(await p.client.mutation(api.foundry.submitInputs, { expectedOwnerId: p.ownerId, roundId: round._id, startTick, inputs })).toEqual(expected);
    }
    await p.client.mutation(api.foundry.finishRound, { expectedOwnerId: p.ownerId, roundId: round._id });
    const resumed = await p.client.query(api.foundry.board, {});
    await expect(p.client.mutation(api.foundry.startRound, { expectedOwnerId: p.ownerId, revision: resumed.progress!.revision, requestId: "next-swift", tool: "swift", assistant: "smith" })).rejects.toThrow("acheté");
    expect(resumed.progress!.mastery).toBe(500);
  });
  it("buys a run hammer once across concurrent tabs, saves equipment and rejects unowned tools", async () => {
    const t = setup(), alice = await player(t, "alice"), bob = await player(t, "bob");
    await expect(alice.client.mutation(api.foundry.purchaseTool, { expectedOwnerId: alice.ownerId, revision: 0, tool: "heavy" })).rejects.toThrow("éclats");
    await expect(alice.client.mutation(api.foundry.startRound, { expectedOwnerId: alice.ownerId, revision: 0, requestId: "unbought", tool: "heavy", assistant: "smith" })).rejects.toThrow("outil");
    let board = await alice.client.query(api.foundry.board, {});
    await t.run((ctx) => ctx.db.patch(board.progress!._id, { cycle: { ...board.progress!.cycle, shards: 680 } }));
    const purchase = { expectedOwnerId: alice.ownerId, revision: 0, tool: "heavy" as const };
    const results = await Promise.allSettled([alice.client.mutation(api.foundry.purchaseTool, purchase), alice.client.mutation(api.foundry.purchaseTool, purchase)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    board = await alice.client.query(api.foundry.board, {});
    expect(board.progress).toMatchObject({ revision: 1, cycle: { shards: 600, purchasedTools: ["heavy"], selectedTool: "heavy" } });
    await expect(alice.client.mutation(api.foundry.purchaseTool, purchase)).rejects.toThrow("changé");
    await expect(alice.client.mutation(api.foundry.purchaseTool, { ...purchase, revision: 1 })).rejects.toThrow("déjà");
    await expect(bob.client.mutation(api.foundry.purchaseTool, { ...purchase, revision: 1 })).rejects.toThrow("compte");
    await expect(alice.client.mutation(api.foundry.equipTool, { ...purchase, revision: 1, tool: "precision" })).rejects.toThrow("outil");
    await alice.client.mutation(api.foundry.equipTool, { ...purchase, revision: 1, tool: "mallet" });
    board = await alice.client.query(api.foundry.board, {});
    expect(board.progress).toMatchObject({ revision: 2, cycle: { shards: 600, selectedTool: "mallet", purchasedTools: ["heavy"] } });
    await alice.client.mutation(api.foundry.equipTool, { ...purchase, revision: 2 });
    expect((await alice.client.query(api.foundry.board, {})).progress!.cycle.selectedTool).toBe("heavy");
  });
  it("replays each purchased hammer's damage and stamina exactly and refuses purchases during a round", async () => {
    const t = setup();
    for (const tool of ["swift", "resonance", "heavy", "precision", "gilded"] as const) {
      const p = await player(t, `buyer-${tool}`); const board = await p.client.query(api.foundry.board, {});
      await t.run((ctx) => ctx.db.patch(board.progress!._id, { cycle: { ...board.progress!.cycle, shards: TOOLS[tool].cost } }));
      await p.client.mutation(api.foundry.purchaseTool, { expectedOwnerId: p.ownerId, revision: 0, tool });
      const round = await p.client.mutation(api.foundry.startRound, { expectedOwnerId: p.ownerId, revision: 1, requestId: `bought-${tool}`, tool, assistant: "smith" });
      expect(round.state.tool).toBe(tool); expect(round.state.stats.damage).toBe(TOOLS[tool].damage);
      const expected = structuredClone(round.state), inputs = [];
      for (let i = 0; i < 40; i++) {
        const target = expected.targets.reduce((a, b) => a.hp < b.hp ? a : b), input = { x: target.x, z: target.z, active: true };
        inputs.push(input); stepFoundry(expected, input);
      }
      vi.setSystemTime(Date.now() + 2000);
      const args = { expectedOwnerId: p.ownerId, roundId: round._id, startTick: 0, inputs };
      expect(await p.client.mutation(api.foundry.submitInputs, args)).toEqual(expected);
      expect(await p.client.mutation(api.foundry.submitInputs, args)).toEqual(expected);
      expect(expected.concentration).toBeCloseTo(100 - expected.rogue!.strikes * TOOLS[tool].stamina);
      await expect(p.client.mutation(api.foundry.purchaseTool, { expectedOwnerId: p.ownerId, revision: 2, tool: "gilded" })).rejects.toThrow("manche");
      await expect(p.client.mutation(api.foundry.equipTool, { expectedOwnerId: p.ownerId, revision: 2, tool: "mallet" })).rejects.toThrow("manche");
      expect((await p.client.query(api.foundry.board, {})).progress!.cycle.selectedTool).toBe(tool);
    }
  });
  it("resets every purchased hammer on restart, retains mastery for charms and accepts old cycles", async () => {
    const t = setup(), p = await player(t, "alice"); let board = await p.client.query(api.foundry.board, {});
    const legacyCycle = { ...board.progress!.cycle, shards: 100, purchasedTools: undefined, selectedTool: undefined };
    await t.run((ctx) => ctx.db.patch(board.progress!._id, { mastery: 3, cycle: legacyCycle }));
    await p.client.mutation(api.foundry.purchaseTool, { expectedOwnerId: p.ownerId, revision: 0, tool: "heavy" });
    await p.client.mutation(api.foundry.abandonChantier, { expectedOwnerId: p.ownerId, revision: 1 });
    await p.client.mutation(api.foundry.newChantier, { expectedOwnerId: p.ownerId, revision: 2 });
    board = await p.client.query(api.foundry.board, {});
    expect(board.progress).toMatchObject({ mastery: 3, revision: 3, cycle: { number: 2, shards: 0, purchasedTools: [], selectedTool: "mallet" } });
    await expect(p.client.mutation(api.foundry.startRound, { expectedOwnerId: p.ownerId, revision: 3, requestId: "reset-shop", tool: "heavy", assistant: "smith" })).rejects.toThrow("outil");
    for (const tool of ["swift", "resonance", "heavy", "precision", "gilded"] as const) {
      await expect(p.client.mutation(api.foundry.startRound, { expectedOwnerId: p.ownerId, revision: 3, requestId: `unowned-${tool}`, tool, assistant: "smith" })).rejects.toThrow("acheté");
      await expect(p.client.mutation(api.foundry.equipTool, { expectedOwnerId: p.ownerId, revision: 3, tool })).rejects.toThrow("acheté");
    }
    const free = await p.client.mutation(api.foundry.startRound, { expectedOwnerId: p.ownerId, revision: 3, requestId: "starting-mallet", tool: "mallet", assistant: "smith" });
    expect(free.state.tool).toBe("mallet");
  });
  it("saves uncapped rounds in separate receipts and finalizes only when stamina is exhausted", async () => {
    const t = setup(); const alice = await player(t, "alice"), round = await begin(alice);
    const initial = structuredClone(round.state); initial.concentration = initial.stats.concentration = 400; initial.targets = [];
    await t.run((ctx) => ctx.db.patch(round._id, { state: initial }));
    const expected = structuredClone(initial), inputs = Array.from({ length: 100 }, () => ({ x: 5.6, z: 3.4, active: false }));
    const first = { expectedOwnerId: alice.ownerId, roundId: round._id, startTick: 0, inputs };
    const totalTicks = 1 + 399 * initial.stats.interval;
    for (let startTick = 0; startTick < totalTicks; startTick += 100) {
      vi.setSystemTime(round.startedAt + (startTick + 100) * 50); inputs.forEach((input) => stepFoundry(expected, input));
      expect(await alice.client.mutation(api.foundry.submitInputs, { ...first, startTick })).toEqual(expected);
      if (startTick === 1900) { expect(expected.ended).toBe(false); await expect(alice.client.mutation(api.foundry.finishRound, { expectedOwnerId: alice.ownerId, roundId: round._id })).rejects.toThrow("terminée"); }
    }
    expect(expected.concentration).toBe(0); expect(expected.ended).toBe(true);
    expect(await alice.client.mutation(api.foundry.submitInputs, first)).toEqual(expected);
    await expect(alice.client.mutation(api.foundry.submitInputs, { ...first, inputs: inputs.map((input) => ({ ...input, x: 0 })) })).rejects.toThrow("autre onglet");
    const stored = await t.run((ctx) => ctx.db.get(round._id)); expect(stored?.batches).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("foundryInputReceipts").collect())).toHaveLength(Math.ceil(totalTicks / 100));
    const finish = { expectedOwnerId: alice.ownerId, roundId: round._id };
    expect(await alice.client.mutation(api.foundry.finishRound, finish)).toEqual(await alice.client.mutation(api.foundry.finishRound, finish));
  });
  it("requires authentication, initializes once, and checks owned assistants and purchased hammers", async () => {
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
    expect(round.state.version).toBe(8);
    expect(round.state.stats.damage).toBe(1);
    expect(round.state.targets.some((relic) => relic.kind === "spring")).toBe(false);
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
  it("confirms head-on rebounds identically to the client, including retried batches", async () => {
    const t = setup(); const alice = await player(t, "alice"); const round = await begin(alice);
    const initial = structuredClone(round.state);
    initial.targets = initial.targets.slice(0, 2).map((relic, i) => ({ ...relic, kind: "urn", x: i ? 0.56 : -0.56, z: 0, vx: i ? -0.03 : 0.03, vz: 0 }));
    await t.run((ctx) => ctx.db.patch(round._id, { state: initial }));
    const inputs = Array.from({ length: 40 }, () => ({ x: 5.6, z: 3.4, active: false }));
    const expected = structuredClone(initial); inputs.forEach((input) => stepFoundry(expected, input));
    vi.setSystemTime(Date.now() + 2000);
    const args = { expectedOwnerId: alice.ownerId, roundId: round._id, startTick: 0, inputs };
    expect(await alice.client.mutation(api.foundry.submitInputs, args)).toEqual(expected);
    expect(await alice.client.mutation(api.foundry.submitInputs, args)).toEqual(expected);
    expect(expected.targets[0]!.vx).toBeLessThan(0); expect(expected.targets[1]!.vx).toBeGreaterThan(0);
    const legacy = structuredClone(initial); legacy.version = 2; legacy.tick = 40;
    await t.run((ctx) => ctx.db.patch(round._id, { state: legacy }));
    const resumed = structuredClone(legacy); inputs.forEach((input) => stepFoundry(resumed, input));
    vi.setSystemTime(Date.now() + 2000);
    expect(await alice.client.mutation(api.foundry.submitInputs, { ...args, startTick: 40 })).toEqual(resumed);
    expect(resumed.targets[0]!.x).toBeGreaterThan(resumed.targets[1]!.x);
  });
  it("serializes skill purchases, validates prerequisites, and retains charms and lifetime mastery after abandoning", async () => {
    const t = setup(); const alice = await player(t, "alice"); const bob = await player(t, "bob");
    let board = await alice.client.query(api.foundry.board, {});
    await t.run((ctx) => ctx.db.patch(board.progress!._id, { mastery: 4, cycle: { ...board.progress!.cycle, shards: 500 } }));
    const purchase = { expectedOwnerId: alice.ownerId, revision: 0, skill: "forge-grip" as const };
    const results = await Promise.allSettled([alice.client.mutation(api.foundry.purchaseSkill, purchase), alice.client.mutation(api.foundry.purchaseSkill, purchase)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    board = await alice.client.query(api.foundry.board, {}); expect(board.progress!.cycle.shards).toBe(470); expect(board.progress!.cycle.skills).toEqual(["forge-grip"]);
    await expect(alice.client.mutation(api.foundry.purchaseSkill, { ...purchase, revision: board.progress!.revision, skill: "forge-mastery" })).rejects.toThrow("reliés");
    await expect(bob.client.mutation(api.foundry.purchaseCharm, { expectedOwnerId: alice.ownerId, revision: 1, charm: "ember" })).rejects.toThrow("autre compte");
    await alice.client.mutation(api.foundry.purchaseCharm, { expectedOwnerId: alice.ownerId, revision: board.progress!.revision, charm: "ember" });
    board = await alice.client.query(api.foundry.board, {}); expect(board.progress).toMatchObject({ mastery: 4, masterySpent: 1, charms: ["ember"] });
    await expect(alice.client.mutation(api.foundry.purchaseCharm, { expectedOwnerId: alice.ownerId, revision: board.progress!.revision, charm: "ember" })).rejects.toThrow("déjà");
    await alice.client.mutation(api.foundry.abandonChantier, { expectedOwnerId: alice.ownerId, revision: board.progress!.revision });
    board = await alice.client.query(api.foundry.board, {}); expect(board.progress!.cycle.status).toBe("abandoned");
    await alice.client.mutation(api.foundry.newChantier, { expectedOwnerId: alice.ownerId, revision: board.progress!.revision });
    board = await alice.client.query(api.foundry.board, {});
    expect(board.progress).toMatchObject({ mastery: 4, masterySpent: 1, charms: ["ember"], cycle: { shards: 0, skills: [], blessings: [] } });
    const fresh = await begin(alice, "next-build"); expect(fresh.state.stats.damage).toBeGreaterThan(foundryStats(legacyCycle(), "mallet", "smith").damage);
    await expect(alice.client.mutation(api.foundry.purchaseSkill, { expectedOwnerId: alice.ownerId, revision: board.progress!.revision + 1, skill: "forge-grip" })).rejects.toThrow("manche");
  });
  it("replays combined techniques and their timers exactly across checkpoints and retries", async () => {
    const t = setup(); const alice = await player(t, "alice"); const board = await alice.client.query(api.foundry.board, {});
    await t.run((ctx) => ctx.db.patch(board.progress!._id, { charms: FOUNDRY_CHARM_IDS, mastery: 50, masterySpent: 18,
      cycle: { ...board.progress!.cycle, skills: FOUNDRY_SKILL_IDS, blessings: ["deepFreeze", "wildfire", "lightning", "berserk"] } }));
    const round = await begin(alice); const initial = structuredClone(round.state);
    Object.assign(initial.rogue!.modifiers, { freezeChance: 1, burnChance: 1, berserkChance: 1, lightningChance: 1 });
    await t.run((ctx) => ctx.db.patch(round._id, { state: initial }));
    const expected = structuredClone(initial); const effects = new Set<string>();
    for (let batch = 0; batch < 8; batch++) {
      const startTick = expected.tick; const inputs = [];
      for (let tick = 0; tick < 40; tick++) {
        const target = expected.targets.reduce((a, b) => a.hp < b.hp ? a : b);
        const input = { x: target.x, z: target.z, active: true }; inputs.push(input);
        stepFoundry(expected, input).effects?.forEach((effect) => effects.add(effect.kind));
      }
      vi.setSystemTime(round.startedAt + (batch + 1) * 2000);
      const args = { expectedOwnerId: alice.ownerId, roundId: round._id, startTick, inputs };
      expect(await alice.client.mutation(api.foundry.submitInputs, args)).toEqual(expected);
      expect(await alice.client.mutation(api.foundry.submitInputs, args)).toEqual(expected);
    }
    expect([...effects]).toEqual(expect.arrayContaining(["freeze", "burn", "frenzy", "lightning", "shockwave"]));
  });
  it("settles each round once, closes an unfunded chantier, and preserves permanent mastery on restart", async () => {
    const t = setup(); const alice = await player(t, "alice");
    const first = await emptyRound(alice, "first");
    const args = { expectedOwnerId: alice.ownerId, roundId: first._id };
    await Promise.all([alice.client.mutation(api.foundry.finishRound, args), alice.client.mutation(api.foundry.finishRound, args)]);
    let board = await alice.client.query(api.foundry.board, {});
    expect(board.progress?.cycle.roundsLeft).toBe(2); expect(board.round).toBeNull();
    const second = await emptyRound(alice, "second"); await alice.client.mutation(api.foundry.finishRound, { ...args, roundId: second._id });
    const third = await emptyRound(alice, "third"); await alice.client.mutation(api.foundry.finishRound, { ...args, roundId: third._id });
    board = await alice.client.query(api.foundry.board, {}); expect(board.progress?.cycle.status).toBe("failed");
    await t.run((ctx) => ctx.db.patch(board.progress!._id, { mastery: 3 }));
    await alice.client.mutation(api.foundry.newChantier, { expectedOwnerId: alice.ownerId, revision: board.progress!.revision });
    board = await alice.client.query(api.foundry.board, {}); expect(board.progress).toMatchObject({ mastery: 3, cycle: { number: 2, orderIndex: 0, shards: 0, status: "active" } });
    await expect(alice.client.mutation(api.foundry.startRound, { expectedOwnerId: alice.ownerId, revision: board.progress!.revision, requestId: "unbought-tool", tool: "resonance", assistant: "dryad" })).rejects.toThrow("acheté");
    await alice.client.mutation(api.foundry.startRound, { expectedOwnerId: alice.ownerId, revision: board.progress!.revision, requestId: "starting-tool", tool: "mallet", assistant: "dryad" });
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
    await t.run((ctx) => ctx.db.patch(board.progress!._id, { cycle: { ...board.progress!.cycle, shards: 25000 } }));
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
    expect(board.progress!.cycle.shards).toBe(500 - FOUNDRY.previousUpgradeCosts[0]);
  });
});

// Saved V8 chantiers keep their original prices, profiles and simulation.
function legacyCycle(number = 1, seed?: number): ReturnType<typeof newFoundryCycle> { return { ...newFoundryCycle(number, seed), economy: 2 as const }; }
