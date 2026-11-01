import { describe, expect, it } from "vitest";
import { createFoundryRound, foundryStats, newFoundryCycle, stepFoundry, foundryStrikeCost, type FoundryTool } from "./foundry";
const air = { x: 5.6, z: 3.4, active: false };
describe("la stamina par frappe", () => {
  it("matches the source's 100-point reserve and 7-point base swing cost, ending on the fifteenth swing", () => {
    const round = createFoundryRound(3, newFoundryCycle(), "mallet");
    expect(round.concentration).toBe(100); expect(round.stats.concentration).toBe(100);
    expect(foundryStrikeCost(round)).toBe(7);
    let shots = 0;
    while (!round.ended) {
      const before = round.concentration, frame = stepFoundry(round, air);
      if (frame.strike) { shots++; expect(round.concentration).toBe(Math.max(0, before - 7)); }
      else expect(round.concentration).toBe(before);
    }
    expect(shots).toBe(15); expect(round.concentration).toBe(0);
  });
  it("adds the original flat stamina bonuses to the source reserve and swing cost", () => {
    const cycle = { ...newFoundryCycle(), skills: ["endurance-stamina-1", "endurance-cost-1"] as const };
    const stats = foundryStats({ ...cycle, skills: [...cycle.skills] }, "mallet");
    expect(stats.concentration).toBe(120); expect(stats.stamina).toBeCloseTo(6.5);
    expect(foundryStats(newFoundryCycle(), "resonance").stamina).toBeCloseTo(6.8);
    expect(foundryStats(newFoundryCycle(), "heavy").stamina).toBeCloseTo(7.6);
    expect(foundryStats(newFoundryCycle(), "spiked").stamina).toBeCloseTo(7.7);
  });
  it("spaces base swings by 1.33 seconds without spending stamina between swings and retains speed upgrades", () => {
    const round = createFoundryRound(3, newFoundryCycle(), "mallet");
    const strikes: number[] = [];
    while (!round.ended) { if (stepFoundry(round, air).strike) strikes.push(round.tick); }
    expect(strikes).toHaveLength(15);
    for (let index = 1; index < strikes.length; index++) expect([26, 27]).toContain(strikes[index]! - strikes[index - 1]!);
    expect(round.tick * 0.05).toBeCloseTo(18.75);
    expect(foundryStats(newFoundryCycle(), "swift").interval).toBeCloseTo(round.stats.interval / 1.35);
    expect(foundryStats({ ...newFoundryCycle(), economy: 5 }, "mallet").interval).toBe(11);
  });
  it("preserves the strike cost and stamina stored in an existing round after a checkpoint", () => {
    const saved = createFoundryRound(3, newFoundryCycle(), "mallet");
    // A V12 round started before the correction stored its original 1-point cost.
    saved.stats.stamina = 1; saved.concentration = 80;
    const resumed = JSON.parse(JSON.stringify(saved));
    expect(foundryStrikeCost(resumed)).toBe(1);
    stepFoundry(resumed, air); expect(resumed.concentration).toBe(79);
    expect(saved.concentration).toBe(80);
  });
  it("spends the same 100 strikes at every attack speed, with no loss during the cooldown", () => {
    const durations: number[] = [];
    for (const tool of ["swift", "mallet", "resonance"] as FoundryTool[]) {
      const round = createFoundryRound(3, legacyCycle(), tool); round.targets = [];
      let shots = 0;
      while (!round.ended) {
        const before = round.concentration, frame = stepFoundry(round, air);
        if (frame.strike) { shots++; expect(round.concentration).toBe(before - 1); }
        else expect(round.concentration).toBe(before);
      }
      expect(shots).toBe(100); expect(round.concentration).toBe(0); durations.push(round.tick);
    }
    expect(durations[0]).toBeLessThan(durations[1]!); expect(durations[1]).toBeLessThan(durations[2]!);
  });
  it("charges once for a hammer swing and nothing for area damage, lightning or burn ticks", () => {
    const round = createFoundryRound(3, legacyCycle(), "resonance");
    round.targets = round.targets.slice(0, 3).map((target, i) => ({ ...target, kind: "urn" as const, x: [-1.2, 0, 2.1][i]!, z: 0, vx: 0, vz: 0, hp: 1000, maxHp: 1000 }));
    Object.assign(round.rogue!.modifiers, { lightningChance: 1, lightningDamage: 0.4, burnChance: 1, burnDamage: 0.2, shockwaveChance: 1, shockwaveDamage: 0.4 });
    const frame = stepFoundry(round, { x: 0, z: 0, active: true });
    expect(frame.impacts.length).toBeGreaterThan(3); expect(round.concentration).toBe(99);
    let burnTick = false;
    while (round.tick + 1 < round.nextStrike) {
      const frame = stepFoundry(round, air); if (!frame.strike && frame.impacts.length) burnTick = true;
      expect(round.concentration).toBe(99);
    }
    expect(burnTick).toBe(true); stepFoundry(round, air); expect(round.concentration).toBe(98);
  });
  it("applies efficiency and fury to each strike while retaining recovery on the final blow", () => {
    const round = createFoundryRound(3, { ...legacyCycle(), blessings: ["efficient"], skills: ["sap-breath", "sap-spring", "sap-flow"] }, "mallet"); round.targets = [];
    expect(foundryStrikeCost(round)).toBeCloseTo(0.7); round.rogue!.frenzyUntil = 100;
    expect(foundryStrikeCost(round)).toBeCloseTo(0.35); const before = round.concentration; stepFoundry(round, air); expect(before - round.concentration).toBeCloseTo(0.35);
    const spring = createFoundryRound(4, legacyCycle(), "mallet"); spring.concentration = 1;
    spring.version = 6;
    spring.targets = [{ ...spring.targets[0]!, kind: "spring", x: 0, z: 0, vx: 0, vz: 0, hp: 1, maxHp: 1 }];
    stepFoundry(spring, { x: 0, z: 0, active: true }); expect(spring.concentration).toBe(8); expect(spring.ended).toBe(false);
  });
});

// Saved V8 chantiers keep their original prices, profiles and simulation.
function legacyCycle(number = 1, seed?: number): ReturnType<typeof newFoundryCycle> { return { ...newFoundryCycle(number, seed), economy: 2 as const }; }
