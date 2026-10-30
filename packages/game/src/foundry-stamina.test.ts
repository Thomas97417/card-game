import { describe, expect, it } from "vitest";
import { createFoundryRound, newFoundryCycle, stepFoundry, foundryStrikeCost, type FoundryTool } from "./foundry";
const air = { x: 5.6, z: 3.4, active: false };
describe("la stamina par frappe", () => {
  it("spends the same 100 strikes at every attack speed, with no loss during the cooldown", () => {
    const durations: number[] = [];
    for (const tool of ["swift", "mallet", "resonance"] as FoundryTool[]) {
      const round = createFoundryRound(3, legacyCycle(), tool, "smith"); round.targets = [];
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
    const round = createFoundryRound(3, legacyCycle(), "resonance", "smith");
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
    const round = createFoundryRound(3, { ...legacyCycle(), blessings: ["efficient"], skills: ["sap-breath", "sap-spring", "sap-flow"] }, "mallet", "smith"); round.targets = [];
    expect(foundryStrikeCost(round)).toBeCloseTo(0.7); round.rogue!.frenzyUntil = 100;
    expect(foundryStrikeCost(round)).toBeCloseTo(0.35); const before = round.concentration; stepFoundry(round, air); expect(before - round.concentration).toBeCloseTo(0.35);
    const spring = createFoundryRound(4, legacyCycle(), "mallet", "smith"); spring.concentration = 1;
    spring.version = 6;
    spring.targets = [{ ...spring.targets[0]!, kind: "spring", x: 0, z: 0, vx: 0, vz: 0, hp: 1, maxHp: 1 }];
    stepFoundry(spring, { x: 0, z: 0, active: true }); expect(spring.concentration).toBe(8); expect(spring.ended).toBe(false);
  });
});

// Saved V8 chantiers keep their original prices, profiles and simulation.
function legacyCycle(number = 1, seed?: number): ReturnType<typeof newFoundryCycle> { return { ...newFoundryCycle(number, seed), economy: 2 as const }; }
