import { describe, expect, it } from "vitest";
import { FOUNDRY, TOOLS, buyFoundryUpgrade, chooseFoundryBlessing, createFoundryRound, deliverFoundryOrder,
  foundryInputDigest, foundryStats, newFoundryCycle, settleFoundryRound, stepFoundry, validFoundryInput,
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
  it("replays identical inputs identically regardless of rendering and batch boundaries", () => {
    const a = round(); const b = round();
    const inputs = Array.from({ length: 780 }, (_, i) => ({ x: Math.sin(i / 25) * 4, z: Math.cos(i / 27) * 2.5, active: i % 13 !== 0 }));
    inputs.forEach((input) => stepFoundry(a, input));
    for (let start = 0; start < inputs.length; start += 40) inputs.slice(start, start + 40).forEach((input) => stepFoundry(b, input));
    expect(a).toEqual(b); expect(a.broken).toBeGreaterThan(5);
    expect(foundryInputDigest(inputs)).toBe(foundryInputDigest(inputs));
    expect(foundryInputDigest(inputs)).not.toBe(foundryInputDigest([...inputs, aim]));
  });
  it("drains exactly 50 seconds without a target and caps long, replenished rounds at 75 seconds", () => {
    const state = round(); while (!state.ended) stepFoundry(state, { ...aim, active: false });
    expect(state.tick).toBe(1000); expect(state.shards).toBe(0);
    const long = createFoundryRound(9, { ...newFoundryCycle(), upgrades: { power: 0, focus: 3, fortune: 0 }, blessings: ["focus", "focus", "focus"] }, "mallet", "dryad");
    while (!long.ended) stepFoundry(long, { ...aim, active: false });
    expect(long.tick).toBe(FOUNDRY.maxTicks);
  });
  it("keeps runners inside the board and sixteen live relics after destruction", () => {
    const state = harvest(round()); expect(state.targets).toHaveLength(16);
    expect(state.targets.every((target) => Math.abs(target.x) < FOUNDRY.width / 2 && Math.abs(target.z) < FOUNDRY.depth / 2)).toBe(true);
    expect(state.broken).toBeGreaterThan(20);
  });
  it("applies area damage, bounded chaos chains, spring recovery, and the tool cooldown", () => {
    const state = createFoundryRound(7, newFoundryCycle(), "resonance", "smith");
    state.concentration = 40;
    state.targets.forEach((target, i) => { target.x = i < 4 ? i * 0.1 : 4; target.z = i < 4 ? 0 : 2; target.vx = 0; target.vz = 0; });
    state.targets[0]!.kind = "chaos"; state.targets[0]!.hp = 1;
    state.targets[1]!.kind = "chaos"; state.targets[1]!.hp = 4;
    state.targets[2]!.kind = "spring"; state.targets[2]!.hp = 4;
    const first = stepFoundry(state, aim);
    expect(first.strike).toBe(true); expect(first.impacts.length).toBeGreaterThanOrEqual(4);
    expect(state.concentration).toBeGreaterThan(47);
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
      expect(cycle.blessings).toHaveLength(i + 1); expect(cycle.roundsLeft).toBe(2);
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
