import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FOUNDRY, TOOL_IDS, TOOLS, LEGACY_TOOLS, LEGACY_FOUNDRY_SKILL_IDS as FOUNDRY_SKILL_IDS, buyFoundrySkill, buyFoundryTool, createFoundryRound,
  foundryOrderCost, foundrySkillCost, foundryStats, foundryStrikeCost, foundryToolDefinition, foundryTools, newFoundryCycle as currentCycle, stepFoundry, type FoundryCycle } from "./foundry";
import { simulateFoundryRun } from "./test-fixtures/foundry-run";

describe("les marteaux de référence et la nouvelle économie", () => {
  it("matches the seven source prices and every hammer modifier in build 24759944", () => {
    const reference = JSON.parse(readFileSync(new URL("../../../docs/references/bills-must-be-paid/build-24759944.json", import.meta.url), "utf8"));
    const items = reference.categories.hammers.items as { slug: string; cost: number; modifiers: { label: string; value: string }[] }[];
    expect(TOOL_IDS).toHaveLength(7);
    for (const id of TOOL_IDS) {
      const spec = TOOLS[id], source = items.find((item) => `hammers/${item.slug}` === spec.source)!;
      expect(source).toBeDefined(); expect(spec.cost).toBe(source.cost);
      const value = (label: string) => Number(source.modifiers.find((m) => m.label === label)?.value.replace("%", "") ?? 0);
      expect(spec.damage).toBe(1 + value("Hammer damage")); expect(spec.cadence).toBe(value("Attack speed") / 100);
      expect(spec.radius).toBeCloseTo(0.72 + value("Hit radius")); expect(spec.stamina).toBeCloseTo(1 + value("Stamina drain"));
      expect(spec.critical).toBe(value("Crit chance") / 100); expect(spec.criticalDamage).toBe(value("Crit damage") / 100);
      expect(spec.loot).toBe(0); // Golden Hammer has critical bonuses, not a loot bonus.
    }
  });
  it("keeps the base hit at one and accurately accumulates fractional attack-speed bonuses", () => {
    expect(foundryStats(newFoundryCycle(), "mallet").damage).toBe(1);
    for (const id of ["swift", "precision", "resonance"] as const) {
      const round = createFoundryRound(12, newFoundryCycle(), id); round.targets = [];
      expect(round.stats.interval).toBeCloseTo(11 / (1 + TOOLS[id].cadence));
      const ticks: number[] = [];
      while (ticks.length < 30) if (stepFoundry(round, { x: 5.6, z: 3.4, active: false }).strike) ticks.push(round.tick);
      expect(ticks[0]).toBe(1); expect(ticks.at(-1)).toBeCloseTo(Math.ceil(1 + 29 * round.stats.interval), 0);
      expect(Math.abs(ticks.at(-1)! - 1 - 29 * round.stats.interval)).toBeLessThan(1.00001);
    }
  });
  it("freezes stamina costs and leaves old chantiers on their complete V8 economy", () => {
    const cycle = { ...newFoundryCycle(), economy: 2 as const, shards: 1000 };
    expect(foundryTools(cycle)).toHaveLength(6); expect(foundryToolDefinition(cycle, "gilded").loot).toBe(0.25);
    expect(foundryOrderCost(cycle)).toBe(100); expect(foundrySkillCost(cycle, "forge-grip")).toBe(30);
    expect(buyFoundryTool(cycle, "heavy").shards).toBe(920); expect(() => buyFoundryTool(cycle, "spiked")).toThrow("nouvel équilibrage");
    const legacy = createFoundryRound(12, cycle, "heavy"); expect(legacy.version).toBe(8);
    expect(legacy.stats.damage).toBe(3); expect(foundryStrikeCost(legacy)).toBe(1.4);
    const modern = createFoundryRound(12, newFoundryCycle(), "heavy"); expect(modern.stats.damage).toBe(45);
    expect(foundryStrikeCost(modern)).toBe(1.6); modern.stats.stamina = 1.25; expect(foundryStrikeCost(modern)).toBe(1.25);
    expect(LEGACY_TOOLS.gilded.stamina).toBe(1.2);
  });
  it("scales deposits and learning prices together and keeps the first payment affordable without upgrades", () => {
    const cycle = newFoundryCycle(); expect(cycle.economy).toBe(3);
    expect(FOUNDRY_SKILL_IDS.reduce((sum, id) => sum + foundrySkillCost(cycle, id), 0)).toBe(10841500);
    expect(buyFoundrySkill({ ...cycle, shards: 300 }, "forge-grip").shards).toBe(0);
    const first = createFoundryRound(17, cycle, "mallet");
    while (!first.ended) { const t = first.targets.reduce((a, b) => a.hp < b.hp ? a : b); stepFoundry(first, { x: t.x, z: t.z, active: true }); }
    expect(first.shards).toBeGreaterThanOrEqual(1000); expect(first.shards * FOUNDRY.roundsPerOrder).toBeGreaterThanOrEqual(foundryOrderCost(cycle)!);
    for (let orderIndex = 0; orderIndex < 5; orderIndex++) {
      const round = createFoundryRound(17, { ...cycle, orderIndex }, "mallet");
      expect(round.rogue!.wealth).toBe(FOUNDRY.lootMultipliers[orderIndex]); expect(round.rogue!.pressure).toBe(FOUNDRY.resistances[orderIndex]);
    }
  });
  it("exhausts stamina even with an endgame recovery build, without a time limit", () => {
    const cycle = { ...newFoundryCycle(), orderIndex: 4, skills: [...FOUNDRY_SKILL_IDS], blessings: ["recovery", "efficient", "berserk", "power"] as const };
    const round = createFoundryRound(91, { ...cycle, blessings: [...cycle.blessings] }, "gilded");
    while (!round.ended && round.tick < 10000) { const t = round.targets.reduce((a, b) => a.hp < b.hp ? a : b); stepFoundry(round, { x: t.x, z: t.z, active: true }); }
    expect(round.ended).toBe(true); expect(round.concentration).toBe(0); expect(round.tick * FOUNDRY.stepMs).toBeGreaterThan(75000);
    expect(round.rogue!.strikes).toBeGreaterThan(round.stats.concentration);
    expect(round.rogue!.recoveryReserve).toBeGreaterThanOrEqual(0);
  });
  it("allows progressive weapon purchases and bills while requiring investment", () => {
    for (const seed of [1, 7, 17, 25]) {
      const invested = simulateFoundryRun(seed, { economy: 3 });
      expect(invested.status).toBe("completed"); expect(invested.rounds).toBe(15);
      expect(invested.purchases.map((p) => p.tool)).toEqual(["swift", "precision", "resonance", "heavy", "spiked", "gilded"]);
      expect(invested.purchases[0]!.round).toBeLessThanOrEqual(3); expect(invested.purchases.at(-1)!.round).toBeGreaterThanOrEqual(13);
      const basic = simulateFoundryRun(seed, { invest: false, economy: 3 }); expect(basic.status).toBe("failed");
      expect(basic.history.at(-1)!.order).toBeGreaterThan(1);
    }
    const careful = simulateFoundryRun(1, { missEvery: 5, reserveBill: true, economy: 3 });
    expect(careful.status).toBe("completed");
    for (const round of careful.history) expect(round.emptySwings).toBe(Math.floor(round.strikes / 5));
  });
});

function newFoundryCycle(): FoundryCycle { return { ...currentCycle(), economy: 3 }; }
