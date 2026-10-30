import { describe, expect, it } from "vitest";
import { FOUNDRY, TOOLS, buyFoundryUpgrade, chooseFoundryBlessing, createFoundryRound, deliverFoundryOrder,
  RELICS, RELIC_KINDS, foundryInputDigest, foundryStats, newFoundryCycle, settleFoundryRound, stepFoundry, validFoundryInput,
  type FoundryInput, type FoundryRound } from "./foundry";

const aim: FoundryInput = { x: 0, z: 0, active: true };
function round() { return createFoundryRound(12345, newFoundryCycle(), "mallet", "smith"); }
function harvest(state: FoundryRound) {
  while (!state.ended) {
    const target = [...state.targets].sort((a, b) => (a.kind === "geode" ? 5 : a.kind === "spring" ? 2 : 0) - (b.kind === "geode" ? 5 : b.kind === "spring" ? 2 : 0) || a.hp - b.hp)[0]!;
    stepFoundry(state, { x: target.x, z: target.z, active: true });
  }
  return state;
}
describe("la fonderie déterministe", () => {
  it("swings in empty space at the tool cadence, even before the aim is moved", () => {
    for (const tool of ["mallet", "swift", "resonance"] as const) {
      const state = createFoundryRound(17, newFoundryCycle(), tool, "smith"); state.targets = [];
      const strikes: number[] = [];
      for (let tick = 0; tick < 80; tick++) {
        const frame = stepFoundry(state, { x: 4, z: 2, active: false });
        if (frame.strike) { strikes.push(state.tick); expect(frame.strikePosition).toEqual({ x: 4, z: 2 }); expect(frame.impacts).toEqual([]); }
      }
      expect(strikes[0]).toBe(1);
      for (let i = 1; i < strikes.length; i++) expect(strikes[i]! - strikes[i - 1]!).toBe(state.stats.interval);
      expect(state.shards).toBe(0); expect(state.concentration).toBe(100 - strikes.length);
    }
  });
  it("replays identical inputs identically regardless of rendering and batch boundaries", () => {
    const a = round(); const b = round();
    const inputs = Array.from({ length: 780 }, (_, i) => ({ x: Math.sin(i / 25) * 4, z: Math.cos(i / 27) * 2.5, active: i % 13 !== 0 }));
    inputs.forEach((input) => stepFoundry(a, input));
    for (let start = 0; start < inputs.length; start += 40) inputs.slice(start, start + 40).forEach((input) => stepFoundry(b, input));
    expect(a).toEqual(b); expect(a.broken).toBeGreaterThan(0);
    expect(foundryInputDigest(inputs)).toBe(foundryInputDigest(inputs));
    expect(foundryInputDigest(inputs)).not.toBe(foundryInputDigest([...inputs, aim]));
  });
  it("ends only at zero stamina, including rounds lasting longer than the former 75-second cap", () => {
    const state = round(); state.targets = []; while (!state.ended) stepFoundry(state, { x: 5.6, z: 3.4, active: false });
    expect(state.tick).toBe(1 + 99 * state.stats.interval); expect(state.rogue!.strikes).toBe(100); expect(state.shards).toBe(0);
    const long = createFoundryRound(9, { ...newFoundryCycle(), upgrades: { power: 0, focus: 3, fortune: 0 }, blessings: ["focus", "focus", "focus"] }, "mallet", "dryad");
    long.targets = [];
    for (let i = 0; i < 1500; i++) stepFoundry(long, { x: 5.6, z: 3.4, active: false });
    expect(long.ended).toBe(false); expect(long.concentration).toBeGreaterThan(0);
    while (!long.ended) stepFoundry(long, { x: 5.6, z: 3.4, active: false });
    expect(long.tick).toBe(1 + (long.stats.concentration - 1) * long.stats.interval); expect(long.concentration).toBe(0);
    const legacy = round(); legacy.version = 4; legacy.concentration = 300;
    while (!legacy.ended) stepFoundry(legacy, { x: 5.6, z: 3.4, active: false }); expect(legacy.tick).toBe(1500);
    const previous = round(); previous.version = 5; previous.targets = [];
    while (!previous.ended) stepFoundry(previous, { x: 5.6, z: 3.4, active: false }); expect(previous.tick).toBe(1000);
  });
  it("keeps all relics inside the board and sixteen live relics after destruction", () => {
    const state = harvest(round()); expect(state.targets).toHaveLength(state.rogue?.capacity ?? 16);
    expect(state.targets.every((target) => Math.abs(target.x) < FOUNDRY.width / 2 && Math.abs(target.z) < FOUNDRY.depth / 2)).toBe(true);
    expect(state.broken).toBeGreaterThan(20);
  });
  it("moves every relic kind with the runner fastest and bounces at the board edges", () => {
    const state = round();
    for (let seed = 1; seed <= 100 && new Set(state.targets.map((t) => t.kind)).size < RELIC_KINDS.length; seed++) {
      state.targets = createFoundryRound(seed, newFoundryCycle(), "mallet", "smith").targets;
    }
    expect(new Set(state.targets.map((t) => t.kind)).size).toBe(RELIC_KINDS.length);
    const before = structuredClone(state.targets);
    for (let tick = 0; tick < 80; tick++) stepFoundry(state, { x: 5.6, z: 3.4, active: false });
    expect(state.version).toBe(6);
    for (const relic of state.targets) {
      const original = before.find((t) => t.id === relic.id)!;
      expect(Math.hypot(relic.x - original.x, relic.z - original.z)).toBeGreaterThan(0.1);
      expect(Math.abs(relic.x)).toBeLessThanOrEqual(FOUNDRY.width / 2 - 0.55);
      expect(Math.abs(relic.z)).toBeLessThanOrEqual(FOUNDRY.depth / 2 - 0.55);
    }
    const runner = before.find((t) => t.kind === "runner")!;
    const geode = before.find((t) => t.kind === "geode")!;
    expect(Math.hypot(runner.vx, runner.vz)).toBeGreaterThan(Math.hypot(geode.vx, geode.vz) * 3);
    const target = state.targets[0]!; target.x = FOUNDRY.width / 2 - 0.551; target.vx = 0.012;
    target.z = FOUNDRY.depth / 2 - 0.551; target.vz = 0.012;
    stepFoundry(state, { x: 5.6, z: 3.4, active: false });
    expect(target.vx).toBeLessThan(0); expect(target.vz).toBeLessThan(0);
  });
  it("keeps saved V1 rounds and their replacement relics on the original movement rules", () => {
    const state = round(); state.version = 1;
    for (const t of state.targets) if (t.kind !== "runner") { t.vx = 0; t.vz = 0; }
    const stationary = state.targets.find((t) => t.kind !== "runner")!;
    const position = { x: stationary.x, z: stationary.z };
    for (let tick = 0; tick < 20; tick++) stepFoundry(state, { x: 5.6, z: 3.4, active: false });
    expect(stationary).toMatchObject(position);
    stationary.hp = 1;
    stepFoundry(state, { ...position, active: true });
    expect(state.targets.filter((t) => t.kind !== "runner").every((t) => t.vx === 0 && t.vz === 0)).toBe(true);
  });
  it("applies area damage, bounded chaos chains, spring recovery, and the tool cooldown", () => {
    const state = createFoundryRound(7, newFoundryCycle(), "resonance", "smith");
    state.concentration = 40;
    state.targets = state.targets.slice(0, 4);
    state.targets.forEach((target, i) => { target.x = [0, 1.31, 0, -1.31][i]!; target.z = i === 2 ? 1.24 : 0; target.vx = 0; target.vz = 0; });
    state.targets[0]!.kind = "chaos"; state.targets[0]!.hp = 1;
    state.targets[1]!.kind = "chaos"; state.targets[1]!.hp = 4;
    state.targets[2]!.kind = "spring"; state.targets[2]!.hp = 4;
    state.targets[3]!.kind = "urn"; state.targets[3]!.hp = state.targets[3]!.maxHp = 100;
    const first = stepFoundry(state, aim);
    expect(first.strike).toBe(true); expect(first.impacts.length).toBeGreaterThanOrEqual(4);
    expect(state.concentration).toBe(47);
    expect(first.impacts.filter((hit) => hit.broken).map((hit) => hit.targetId)).toEqual(expect.arrayContaining([1, 2, 3]));
    expect(stepFoundry(state, aim).strike).toBe(false);
  });
  it("rejects non-finite and out-of-bounds input without advancing the simulation", () => {
    for (const input of [{ ...aim, x: NaN }, { ...aim, z: Infinity }, { ...aim, x: 6 }]) {
      expect(validFoundryInput(input)).toBe(false); const state = round();
      expect(() => stepFoundry(state, input)).toThrow(); expect(state.tick).toBe(0);
    }
  });
  it("applies assistant and upgrade bonuses independently of collection combat stats", () => {
    const cycle = newFoundryCycle();
    expect(foundryStats(cycle, "mallet", "smith").damage).toBeCloseTo(TOOLS.mallet.damage * 1.15);
    expect(foundryStats(cycle, "mallet", "dryad").concentration).toBe(115);
    expect(foundryStats(cycle, "mallet", "feline").loot).toBe(1.15);
    const upgraded = buyFoundryUpgrade({ ...cycle, shards: 350 }, "power");
    expect(upgraded.shards).toBe(300); expect(foundryStats(upgraded, "mallet", "smith").damage).toBeGreaterThan(foundryStats(cycle, "mallet", "smith").damage);
  });
  it("makes the first order affordable with the starting tool", () => {
    let cycle = newFoundryCycle();
    for (let i = 0; i < 2 && cycle.shards < FOUNDRY.orderCosts[0]; i++) cycle = settleFoundryRound(cycle, harvest(createFoundryRound(i + 17, cycle, "mallet", "smith")));
    expect(cycle.status).toBe("active"); expect(cycle.shards).toBeGreaterThanOrEqual(100);
  });
});
describe("les collisions des reliques", () => {
  function pair() {
    const state = round();
    state.targets = state.targets.slice(0, 2).map((t, i) => ({ ...t, kind: "urn" as const, x: i ? 0.56 : -0.56, z: 0, vx: i ? -0.03 : 0.03, vz: 0 }));
    return state;
  }
  const idle = { x: 5.6, z: 3.4, active: false };
  it("rebounds head-on without crossing or consuming loot randomness", () => {
    const state = pair(); const rng = state.rng;
    stepFoundry(state, idle);
    expect(state.targets[0]!.vx).toBeCloseTo(-0.03, 10); expect(state.targets[1]!.vx).toBeCloseTo(0.03, 10);
    for (let tick = 0; tick < 40; tick++) stepFoundry(state, idle);
    expect(state.targets[0]!.x).toBeLessThan(state.targets[1]!.x - RELICS.urn.radius * 2);
    expect(state.rng).toBe(rng);
  });
  it("preserves momentum and energy on oblique contacts between different masses", () => {
    const state = pair();
    Object.assign(state.targets[0]!, { x: -0.56, z: 0.1, vx: 0.03, vz: 0.005 });
    Object.assign(state.targets[1]!, { kind: "geode", x: 0.68, z: -0.1, vx: -0.012, vz: 0 });
    const totals = () => state.targets.reduce((sum, t) => {
      const mass = RELICS[t.kind].mass;
      return { x: sum.x + mass * t.vx, z: sum.z + mass * t.vz, energy: sum.energy + mass * (t.vx * t.vx + t.vz * t.vz) };
    }, { x: 0, z: 0, energy: 0 });
    const before = totals(); stepFoundry(state, idle); const after = totals();
    expect(after.x).toBeCloseTo(before.x, 10); expect(after.z).toBeCloseTo(before.z, 10); expect(after.energy).toBeCloseTo(before.energy, 10);
    expect(state.targets[0]!.vz).not.toBe(0.005);
    expect(Math.hypot(state.targets[1]!.x - state.targets[0]!.x, state.targets[1]!.z - state.targets[0]!.z)).toBeGreaterThanOrEqual(RELICS.urn.radius + RELICS.geode.radius);
  });
  it("separates coincident centers at a corner and never pushes a body off the worktop", () => {
    const state = pair();
    for (const t of state.targets) Object.assign(t, { x: FOUNDRY.width / 2 - RELICS.urn.radius, z: FOUNDRY.depth / 2 - RELICS.urn.radius, vx: 0, vz: 0 });
    stepFoundry(state, idle);
    for (const t of state.targets) {
      expect(Number.isFinite(t.x + t.z + t.vx + t.vz)).toBe(true);
      expect(Math.abs(t.x) + RELICS[t.kind].radius).toBeLessThanOrEqual(FOUNDRY.width / 2 + 1e-9);
      expect(Math.abs(t.z) + RELICS[t.kind].radius).toBeLessThanOrEqual(FOUNDRY.depth / 2 + 1e-9);
    }
    expect(Math.hypot(state.targets[1]!.x - state.targets[0]!.x, state.targets[1]!.z - state.targets[0]!.z)).toBeGreaterThanOrEqual(RELICS.urn.radius * 2 - 1e-6);
  });
  it("does not bounce an already separating pair a second time", () => {
    const state = pair(); Object.assign(state.targets[0]!, { x: -0.53, vx: -0.01 }); Object.assign(state.targets[1]!, { x: 0.53, vx: 0.01 });
    stepFoundry(state, idle);
    expect(state.targets[0]!.vx).toBe(-0.01); expect(state.targets[1]!.vx).toBe(0.01);
    expect(state.targets[1]!.x - state.targets[0]!.x).toBeGreaterThanOrEqual(RELICS.urn.radius * 2);
  });
  it("keeps new spawns and moving groups separated throughout harvested rounds", () => {
    let minimumGap = Infinity;
    for (let seed = 1; seed <= 8; seed++) {
      const state = createFoundryRound(seed, newFoundryCycle(), "mallet", "smith");
      while (!state.ended) {
        for (let i = 0; i < state.targets.length; i++) for (let j = i + 1; j < state.targets.length; j++) {
          const a = state.targets[i]!, b = state.targets[j]!;
          minimumGap = Math.min(minimumGap, Math.hypot(a.x - b.x, a.z - b.z) - RELICS[a.kind].radius - RELICS[b.kind].radius);
        }
        const target = state.targets[state.tick % state.targets.length]!;
        stepFoundry(state, { x: target.x, z: target.z, active: true });
      }
    }
    expect(minimumGap).toBeGreaterThanOrEqual(-1e-5);
  });
  it("retains the original non-colliding paths of persisted V2 rounds", () => {
    const state = pair(); state.version = 2;
    for (let tick = 0; tick < 40; tick++) stepFoundry(state, idle);
    expect(state.targets[0]!.x).toBeGreaterThan(state.targets[1]!.x);
    expect(state.targets[0]!.vx).toBe(0.03); expect(state.targets[1]!.vx).toBe(-0.03);
  });
});
describe("commandes et savoir", () => {
  it("allows the last round's loot to pay the deadline, but closes an unfunded chantier", () => {
    const state = { ...round(), ended: true, shards: 50 };
    const cycle = { ...newFoundryCycle(), shards: 50, roundsLeft: 1 };
    const settled = settleFoundryRound(cycle, state);
    expect(settled.status).toBe("active"); expect(settled.roundsLeft).toBe(0);
    expect(() => buyFoundryUpgrade(settled, "power")).toThrow("Livre");
    expect(deliverFoundryOrder(settled).orderIndex).toBe(1);
    expect(settleFoundryRound({ ...cycle, shards: 49 }, state).status).toBe("failed");
  });
  it("offers three different blessings, blocks actions until selection, and completes five orders", () => {
    let cycle = { ...newFoundryCycle(), shards: 5000 };
    for (let i = 0; i < 5; i++) {
      cycle = deliverFoundryOrder(cycle);
      expect(new Set(cycle.choices).size).toBe(3);
      expect(() => buyFoundryUpgrade(cycle, "focus")).toThrow();
      const offered = cycle.choices[0]!; cycle = chooseFoundryBlessing(cycle, offered);
      expect(cycle.blessings).toHaveLength(i + 1); expect(cycle.roundsLeft).toBe(FOUNDRY.roundsPerOrder);
    }
    expect(cycle.status).toBe("completed");
    expect(newFoundryCycle(cycle.number + 1)).toMatchObject({ number: 2, shards: 0, orderIndex: 0, blessings: [], upgrades: { power: 0, focus: 0, fortune: 0 } });
  });
  it("charges upgrade tiers exactly and refuses unavailable purchases", () => {
    let cycle = { ...newFoundryCycle(), shards: 1000 };
    for (let i = 0; i < 3; i++) cycle = buyFoundryUpgrade(cycle, "power");
    expect(cycle.shards).toBe(650); expect(() => buyFoundryUpgrade(cycle, "power")).toThrow("maximum");
    expect(() => buyFoundryUpgrade(newFoundryCycle(), "focus")).toThrow("manque");
    expect(() => chooseFoundryBlessing(newFoundryCycle(), "power")).toThrow("proposée");
  });
});
