import { describe, expect, it } from "vitest";
import { BLESSINGS, FOUNDRY, FOUNDRY_SKILLS, LEGACY_FOUNDRY_SKILL_IDS as FOUNDRY_SKILL_IDS, FOUNDRY_CHARM_IDS, buyFoundrySkill, buyFoundryCharm,
  createFoundryRound, newFoundryCycle, deliverFoundryOrder, chooseFoundryBlessing, foundryOrderCost, foundryStats, settleFoundryRound, stepFoundry } from "./foundry";
const idle = { x: 5.6, z: 3.4, active: false };
function isolated() {
  const round = createFoundryRound(123, legacyCycle(), "mallet", "smith");
  round.targets = round.targets.slice(0, 3).map((t, i) => ({ ...t, kind: "urn" as const, x: i * 1.3, z: 0, hp: 100, maxHp: 100, vx: 0, vz: 0 }));
  return round;
}
describe("les builds de la fonderie", () => {
  it("has 30 connected skills with valid prerequisites and exact single-purchase costs", () => {
    expect(FOUNDRY_SKILL_IDS).toHaveLength(30);
    for (const id of FOUNDRY_SKILL_IDS) {
      const visit = (key: string, path: string[]) => {
        expect(path).not.toContain(key); expect(key in FOUNDRY_SKILLS).toBe(true);
        for (const parent of FOUNDRY_SKILLS[key as typeof id].requires) visit(parent, [...path, key]);
      }; visit(id, []);
    }
    let cycle = { ...legacyCycle(), shards: 5000 };
    expect(() => buyFoundrySkill(cycle, "forge-mastery")).toThrow("reliés");
    cycle = buyFoundrySkill(cycle, "forge-grip"); expect(cycle.shards).toBe(4970);
    expect(() => buyFoundrySkill(cycle, "forge-grip")).toThrow("déjà");
    for (const id of FOUNDRY_SKILL_IDS) if (!cycle.skills?.includes(id)) cycle = buyFoundrySkill(cycle, id);
    expect(cycle.skills).toHaveLength(30); expect(cycle.shards).toBe(1850);
    expect(() => buyFoundrySkill({ ...legacyCycle(), shards: 29 }, "forge-grip")).toThrow("éclats");
  });
  it("offers distinct seeded perks, at least one technique, variation and bounded stacks", () => {
    const variants = new Set<string>();
    for (let seed = 1; seed <= 16; seed++) {
      const cycle = { ...legacyCycle(1, seed), shards: 5000 }, paid = deliverFoundryOrder(cycle);
      expect(new Set(paid.choices).size).toBe(3); expect(paid.choices.some((id) => BLESSINGS[id].kind === "technique")).toBe(true);
      expect(deliverFoundryOrder(cycle).choices).toEqual(paid.choices); variants.add(paid.choices.join(","));
    }
    expect(variants.size).toBeGreaterThan(8);
    const paid = deliverFoundryOrder({ ...legacyCycle(), shards: 5000, blessings: ["power", "power", "power"] });
    expect(paid.choices).not.toContain("power"); expect(() => chooseFoundryBlessing({ ...paid, choices: ["power"] }, "power")).toThrow("maximum");
  });
  it("applies pact tradeoffs and keeps permanent spending separate from lifetime mastery", () => {
    const cycle = legacyCycle(), base = foundryStats(cycle, "mallet", "smith");
    const pact = foundryStats({ ...cycle, blessings: ["brute", "greed"] }, "mallet", "smith");
    expect(pact.damage).toBeGreaterThan(base.damage); expect(pact.loot).toBeGreaterThan(base.loot);
    expect(pact.concentration).toBeLessThan(base.concentration); expect(pact.critical).toBeLessThan(base.critical);
    const permanent = buyFoundryCharm(3, 0, [], "ember"); expect(permanent).toEqual({ masterySpent: 1, charms: ["ember"] });
    expect(() => buyFoundryCharm(3, 1, permanent.charms, "ember")).toThrow("déjà"); expect(() => buyFoundryCharm(3, 1, permanent.charms, "echo")).toThrow("maîtrise");
    expect(foundryStats(legacyCycle(2), "mallet", "smith", permanent.charms).damage).toBeGreaterThan(base.damage); expect(FOUNDRY_CHARM_IDS).toHaveLength(6);
  });
  it("replaces the source skill with a stamina reserve without depending on removed relics", () => {
    let cycle = buyFoundrySkill({ ...legacyCycle(), shards: 100 }, "sap-breath");
    expect(foundryStats(cycle, "mallet", "smith").concentration).toBe(115);
    cycle = buyFoundrySkill(cycle, "sap-spring");
    expect(foundryStats(cycle, "mallet", "smith").concentration).toBe(125);
    expect(FOUNDRY_SKILLS["sap-spring"].detail).not.toContain("sources");
  });
  it("freezes movement for 2.5 seconds, then restores the unchanged velocity", () => {
    const round = isolated(); round.targets[0]!.vx = 0.012; round.rogue!.modifiers.freezeChance = 1; round.rogue!.nextFreeze = 1;
    const result = stepFoundry(round, idle), x = round.targets[0]!.x;
    expect(result.effects?.some((event) => event.kind === "freeze")).toBe(true); expect(round.rogue!.frozenUntil).toBe(1 + FOUNDRY.freezeTicks);
    round.rogue!.modifiers.freezeChance = 0;
    for (let i = 0; i < FOUNDRY.freezeTicks - 1; i++) stepFoundry(round, idle);
    expect(round.targets[0]!.x).toBe(x); stepFoundry(round, idle); expect(round.targets[0]!.x).toBeGreaterThan(x); expect(round.targets[0]!.vx).toBe(0.012);
  });
  it("damages targets beyond hammer range with lightning and shockwaves and reports their effects", () => {
    const round = isolated(); Object.assign(round.rogue!.modifiers, { lightningChance: 1, lightningDamage: 0.5, shockwaveChance: 1, shockwaveDamage: 0.4 });
    const result = stepFoundry(round, { x: 0, z: 0, active: true });
    expect(result.impacts.some((hit) => hit.targetId === round.targets[1]!.id)).toBe(true); expect(result.impacts.some((hit) => hit.targetId === round.targets[2]!.id)).toBe(true);
    expect(result.effects?.map((effect) => effect.kind)).toEqual(expect.arrayContaining(["lightning", "shockwave"]));
  });
  it("burns every half-second, can finish a relic and credits loot once", () => {
    const round = isolated(); Object.assign(round.rogue!.modifiers, { burnChance: 1, burnDamage: 10 });
    const id = round.targets[0]!.id; round.targets[0]!.hp = 5;
    stepFoundry(round, { x: 0, z: 0, active: true }); expect(round.rogue!.burns).toHaveLength(1);
    for (let i = 0; i < FOUNDRY.burnEveryTicks - 1; i++) stepFoundry(round, idle);
    expect(round.broken).toBe(0); const result = stepFoundry(round, idle);
    expect(result.strike).toBe(false); expect(result.impacts.find((hit) => hit.targetId === id)?.broken).toBe(true); expect(round.broken).toBe(1);
    const loot = round.shards; for (let i = 0; i < 20; i++) stepFoundry(round, idle);
    expect(round.shards).toBe(loot); expect(round.rogue!.burns).toHaveLength(0);
  });
  it("starts timed fury, halves the strike cost, and bounds chained kills", () => {
    const round = isolated(); round.targets.forEach((target) => { target.hp = target.maxHp = 1; });
    Object.assign(round.rogue!.modifiers, { berserkChance: 1, chainChance: 1, chainDamage: 1 });
    const result = stepFoundry(round, { x: 0, z: 0, active: true });
    expect(result.impacts.filter((hit) => hit.broken)).toHaveLength(3); expect(round.broken).toBe(3); expect(round.rogue!.frenzyUntil).toBe(1 + FOUNDRY.berserkTicks);
    const focus = round.concentration; round.targets = [];
    while (round.tick + 1 < round.nextStrike) { stepFoundry(round, idle); expect(round.concentration).toBe(focus); }
    expect(stepFoundry(round, idle).strike).toBe(true); expect(focus - round.concentration).toBeCloseTo(FOUNDRY.staminaPerStrike / 2);
  });
  it("combines first-kill recovery with a permanent first shockwave", () => {
    const cycle = { ...legacyCycle(), skills: ["fortune-purity", "sap-second"] as ("fortune-purity" | "sap-second")[] };
    const round = createFoundryRound(42, cycle, "mallet", "smith", ["echo"]); round.concentration = 50; round.targets = round.targets.slice(0, 1);
    const target = round.targets[0]!; target.hp = target.maxHp = 1;
    const result = stepFoundry(round, { x: target.x, z: target.z, active: true });
    expect(round.concentration).toBe(59); expect(result.effects?.some((effect) => effect.kind === "shockwave")).toBe(true); expect(round.rogue!.strikes).toBe(1);
  });
  it("preserves old bill amounts and makes the first new bill affordable after investing", () => {
    const old = { ...legacyCycle(), economy: undefined, orderIndex: 4 }; expect(foundryOrderCost(old)).toBe(850); expect(foundryOrderCost({ ...old, economy: 2 })).toBe(1500);
    let cycle = legacyCycle(); const round = createFoundryRound(25, cycle, "mallet", "smith");
    while (!round.ended) { const target = round.targets.reduce((a, b) => a.hp < b.hp ? a : b); stepFoundry(round, { x: target.x, z: target.z, active: true }); }
    cycle = settleFoundryRound(cycle, round); expect(cycle.shards).toBeGreaterThanOrEqual(130); cycle = buyFoundrySkill(cycle, "forge-grip");
    expect(cycle.shards).toBeGreaterThanOrEqual(100); expect(deliverFoundryOrder(cycle).orderIndex).toBe(1); expect(legacyCycle(2).skills).toEqual([]);
  });
});

// Saved V8 chantiers keep their original prices, profiles and simulation.
function legacyCycle(number = 1, seed?: number): ReturnType<typeof newFoundryCycle> { return { ...newFoundryCycle(number, seed), economy: 2 as const }; }
