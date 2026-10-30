import { describe, expect, it } from "vitest";
import { TOOL_IDS, TOOLS, buyFoundryTool, chooseFoundryBlessing, createFoundryRound, deliverFoundryOrder, equipFoundryTool, foundryStats,
  foundryStrikeCost, newFoundryCycle, ownsFoundryTool, settleFoundryRound, stepFoundry, type FoundryTool } from "./foundry";

describe("les marteaux achetés pendant le chantier", () => {
  it("charges each purchase once, equips it and lets the player change owned tools for free", () => {
    const original = { ...newFoundryCycle(), shards: 12000000 };
    let cycle = original;
    for (const tool of TOOL_IDS.filter((id) => id !== "mallet")) {
      const before = cycle.shards; cycle = buyFoundryTool(cycle, tool);
      expect(cycle.shards).toBe(before - TOOLS[tool].cost); expect(cycle.selectedTool).toBe(tool);
      expect(ownsFoundryTool(cycle, tool)).toBe(true);
      expect(() => buyFoundryTool(cycle, tool)).toThrow("déjà");
    }
    expect(original.shards).toBe(12000000); expect(original.purchasedTools).toEqual([]);
    const equipped = equipFoundryTool(cycle, "heavy");
    expect(equipped.selectedTool).toBe("heavy"); expect(equipped.shards).toBe(cycle.shards);
    expect(equipFoundryTool(equipped, "mallet").selectedTool).toBe("mallet");
  });
  it("rejects unfunded purchases, buying the free mallet, closed deadlines and pending blessings", () => {
    const cycle = { ...newFoundryCycle(), shards: TOOLS.heavy.cost - 1 };
    expect(() => buyFoundryTool(cycle, "heavy")).toThrow("éclats");
    expect(() => buyFoundryTool({ ...cycle, shards: 500 }, "mallet")).toThrow("gratuit");
    expect(() => equipFoundryTool(cycle, "heavy")).toThrow("outil");
    expect(() => equipFoundryTool(cycle, "resonance")).toThrow("outil");
    for (const blocked of [
      { ...cycle, shards: 1000, status: "failed" as const }, { ...cycle, shards: 1000, status: "completed" as const },
      { ...cycle, shards: 1000, status: "abandoned" as const }, { ...cycle, shards: 1000, roundsLeft: 0 },
      { ...cycle, shards: 1000, choices: ["power" as const] },
    ]) {
      expect(() => buyFoundryTool(blocked, "heavy")).toThrow();
      expect(() => equipFoundryTool(blocked, "resonance")).toThrow();
    }
  });
  it("keeps purchases across rounds and deliveries, then resets every hammer except the starting mallet", () => {
    const bought = buyFoundryTool({ ...newFoundryCycle(), shards: TOOLS.heavy.cost + 5000 }, "heavy");
    const round = { ...createFoundryRound(12, bought, "heavy", "smith"), ended: true, shards: 23 };
    const settled = settleFoundryRound(bought, round), delivered = deliverFoundryOrder(settled);
    const blessed = chooseFoundryBlessing(delivered, delivered.choices[0]!);
    expect(blessed.purchasedTools).toEqual(["heavy"]); expect(blessed.selectedTool).toBe("heavy");
    const next = newFoundryCycle(2);
    expect(next.purchasedTools).toEqual([]); expect(next.selectedTool).toBe("mallet"); expect(ownsFoundryTool(next, "heavy")).toBe(false);
    expect(ownsFoundryTool(next, "mallet")).toBe(true);
    for (const tool of ["swift", "resonance", "heavy", "precision", "spiked", "gilded"] as const) expect(ownsFoundryTool(next, tool)).toBe(false);
    const legacy = { ...next, purchasedTools: undefined, selectedTool: "resonance" as const };
    expect(ownsFoundryTool(legacy, "mallet")).toBe(true); expect(ownsFoundryTool(legacy, "resonance")).toBe(false);
  });
  it("applies tool-specific stamina costs on every swing, including empty swings and efficiency bonuses", () => {
    for (const tool of ["swift", "resonance", "heavy", "precision", "spiked", "gilded"] as FoundryTool[]) {
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
    expect(round.stats.damage).toBeCloseTo(5 * 1.23); expect(round.stats.critical).toBe(0.25);
    expect(round.rogue!.modifiers.criticalDamage).toBe(0.6); round.stats.critical = 1;
    round.targets = [{ ...round.targets[0]!, kind: "urn", hp: 100, maxHp: 100, x: 0, z: 0, vx: 0, vz: 0 }];
    const hit = stepFoundry(round, { x: 0, z: 0, active: true }).impacts[0]!;
    expect(hit.critical).toBe(true); expect(hit.damage).toBeCloseTo(round.stats.damage * 2.6);
  });
  it("keeps the amber hammer's loot normal while its critical bonuses combine with the feline", () => {
    const cycle = newFoundryCycle(), plain = createFoundryRound(22, cycle, "mallet", "smith"), gilded = createFoundryRound(22, cycle, "gilded", "smith");
    for (const round of [plain, gilded]) {
      round.stats.critical = 0;
      round.targets = [{ ...round.targets[0]!, kind: "urn", hp: 1, maxHp: 1, x: 0, z: 0, vx: 0, vz: 0 }];
    }
    const normal = stepFoundry(plain, { x: 0, z: 0, active: true }).impacts[0]!.loot;
    expect(stepFoundry(gilded, { x: 0, z: 0, active: true }).impacts[0]!.loot).toBe(normal);
    expect(foundryStats(cycle, "gilded", "feline").loot).toBeCloseTo(1.15);
  });
});
