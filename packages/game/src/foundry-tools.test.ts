import { describe, expect, it } from "vitest";
import { TOOLS, buyFoundryTool, chooseFoundryBlessing, createFoundryRound, deliverFoundryOrder, equipFoundryTool, foundryStats,
  foundryStrikeCost, newFoundryCycle, ownsFoundryTool, settleFoundryRound, stepFoundry, type FoundryTool } from "./foundry";

describe("les marteaux achetés pendant le chantier", () => {
  it("charges each purchase once, equips it and lets the player change owned tools for free", () => {
    const original = { ...newFoundryCycle(), shards: 1000 };
    let cycle = original;
    for (const tool of ["heavy", "precision", "gilded"] as const) {
      const before = cycle.shards; cycle = buyFoundryTool(cycle, tool);
      expect(cycle.shards).toBe(before - TOOLS[tool].cost); expect(cycle.selectedTool).toBe(tool);
      expect(ownsFoundryTool(cycle, 0, tool)).toBe(true);
      expect(() => buyFoundryTool(cycle, tool)).toThrow("déjà");
    }
    expect(original.shards).toBe(1000); expect(original.purchasedTools).toEqual([]);
    const equipped = equipFoundryTool(cycle, 0, "heavy");
    expect(equipped.selectedTool).toBe("heavy"); expect(equipped.shards).toBe(cycle.shards);
    expect(equipFoundryTool(equipped, 0, "mallet").selectedTool).toBe("mallet");
  });
  it("rejects unfunded purchases, borrowed tools, closed deadlines and pending blessings", () => {
    const cycle = { ...newFoundryCycle(), shards: TOOLS.heavy.cost - 1 };
    expect(() => buyFoundryTool(cycle, "heavy")).toThrow("éclats");
    expect(() => buyFoundryTool({ ...cycle, shards: 500 }, "swift")).toThrow("commandes");
    expect(() => equipFoundryTool(cycle, 0, "heavy")).toThrow("outil");
    expect(() => equipFoundryTool(cycle, 0, "resonance")).toThrow("outil");
    for (const blocked of [
      { ...cycle, shards: 1000, status: "failed" as const }, { ...cycle, shards: 1000, status: "completed" as const },
      { ...cycle, shards: 1000, status: "abandoned" as const }, { ...cycle, shards: 1000, roundsLeft: 0 },
      { ...cycle, shards: 1000, choices: ["power" as const] },
    ]) {
      expect(() => buyFoundryTool(blocked, "heavy")).toThrow();
      expect(() => equipFoundryTool(blocked, 3, "resonance")).toThrow();
    }
  });
  it("keeps purchases across rounds and deliveries, resets them for the next chantier and keeps refuge unlocks", () => {
    const bought = buyFoundryTool({ ...newFoundryCycle(), shards: 1000 }, "heavy");
    const round = { ...createFoundryRound(12, bought, "heavy", "smith"), ended: true, shards: 23 };
    const settled = settleFoundryRound(bought, round), delivered = deliverFoundryOrder(settled);
    const blessed = chooseFoundryBlessing(delivered, delivered.choices[0]!);
    expect(blessed.purchasedTools).toEqual(["heavy"]); expect(blessed.selectedTool).toBe("heavy");
    const next = newFoundryCycle(2);
    expect(next.purchasedTools).toEqual([]); expect(next.selectedTool).toBe("mallet"); expect(ownsFoundryTool(next, 50, "heavy")).toBe(false);
    expect(ownsFoundryTool(next, 0, "mallet")).toBe(true); expect(ownsFoundryTool(next, 1, "swift")).toBe(true);
    expect(ownsFoundryTool(next, 2, "resonance")).toBe(false); expect(ownsFoundryTool(next, 3, "resonance")).toBe(true);
    const legacy = { ...next, purchasedTools: undefined, selectedTool: undefined };
    expect(ownsFoundryTool(legacy, 3, "resonance")).toBe(true); expect(ownsFoundryTool(legacy, 3, "gilded")).toBe(false);
  });
  it("applies tool-specific stamina costs on every swing, including empty swings and efficiency bonuses", () => {
    for (const tool of ["heavy", "precision", "gilded"] as FoundryTool[]) {
      const round = createFoundryRound(2, newFoundryCycle(), tool, "smith"); round.targets = [];
      expect(foundryStrikeCost(round)).toBe(TOOLS[tool].stamina);
      while (!round.ended) stepFoundry(round, { x: 5.6, z: 3.4, active: false });
      expect(round.rogue!.strikes).toBe(Math.ceil(100 / TOOLS[tool].stamina)); expect(round.concentration).toBe(0);
      const efficient = createFoundryRound(2, { ...newFoundryCycle(), blessings: ["efficient"] }, tool, "smith");
      expect(foundryStrikeCost(efficient)).toBeCloseTo(TOOLS[tool].stamina * 0.85);
      efficient.rogue!.frenzyUntil = 100; expect(foundryStrikeCost(efficient)).toBeCloseTo(TOOLS[tool].stamina * 0.85 / 2);
    }
  });
  it("combines the engraver's critical bonuses with the build and freezes them in the round", () => {
    const cycle = { ...newFoundryCycle(), blessings: ["power" as const] }, round = createFoundryRound(9, cycle, "precision", "smith");
    expect(round.stats.damage).toBeCloseTo(2.2 * 1.23); expect(round.stats.critical).toBe(0.25);
    expect(round.rogue!.modifiers.criticalDamage).toBe(0.6); round.stats.critical = 1;
    round.targets = [{ ...round.targets[0]!, kind: "urn", hp: 100, maxHp: 100, x: 0, z: 0, vx: 0, vz: 0 }];
    const hit = stepFoundry(round, { x: 0, z: 0, active: true }).impacts[0]!;
    expect(hit.critical).toBe(true); expect(hit.damage).toBeCloseTo(round.stats.damage * 2.6);
  });
  it("awards the amber hammer's extra loot and combines it with the feline", () => {
    const cycle = newFoundryCycle(), plain = createFoundryRound(22, cycle, "mallet", "smith"), gilded = createFoundryRound(22, cycle, "gilded", "smith");
    for (const round of [plain, gilded]) {
      round.stats.critical = 0;
      round.targets = [{ ...round.targets[0]!, kind: "urn", hp: 1, maxHp: 1, x: 0, z: 0, vx: 0, vz: 0 }];
    }
    const normal = stepFoundry(plain, { x: 0, z: 0, active: true }).impacts[0]!.loot;
    expect(stepFoundry(gilded, { x: 0, z: 0, active: true }).impacts[0]!.loot).toBe(Math.round(normal * 1.25));
    expect(foundryStats(cycle, "gilded", "feline").loot).toBeCloseTo(1.25 * 1.15);
  });
});
