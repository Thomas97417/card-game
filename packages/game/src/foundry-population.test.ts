import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createFoundryRound, newFoundryCycle, stepFoundry, foundryOrderCost, FOUNDRY_REFERENCE_SKILL_IDS, FOUNDRY_REFERENCE_SKILLS, FOUNDRY_POPULATION, FOUNDRY_PACING, FOUNDRY_RELIC_PROFILES, foundryReferenceDrop, spawnFoundryRelic, type FoundryRound } from "./foundry";

const miss = { x: 5.6, z: 3.4, active: false };
function round() { const r = createFoundryRound(19, newFoundryCycle(), "mallet"); r.stats.critical = 0; return r; }
function destroy(r: FoundryRound) {
  const target = r.targets[0]!; target.hp = 1; target.vx = target.vz = 0; r.nextStrike = r.tick + 1;
  return stepFoundry(r, { x: target.x, z: target.z, active: true });
}

describe("population et butin de référence", () => {
  it("starts with four fragile 3-HP relics and uses the source starting-population increments", () => {
    const r = round(); expect(r.version).toBe(13); expect(r.targets).toHaveLength(4);
    expect(r.targets.every((target) => target.kind === "urn" && target.maxHp === 3)).toBe(true);
    const skills = FOUNDRY_REFERENCE_SKILL_IDS.filter((id) => FOUNDRY_REFERENCE_SKILLS[id].branch === "echo");
    expect(createFoundryRound(19, { ...newFoundryCycle(), skills }, "mallet").targets).toHaveLength(22);
  });
  it("does not replace individual kills and respawns one relic after an empty desk has waited 0.5 seconds", () => {
    const r = round(); destroy(r); expect(r.targets).toHaveLength(3);
    r.targets = [r.targets[0]!]; destroy(r); expect(r.targets).toHaveLength(0);
    const deadline = r.rogue!.complete!.nextEmptySpawn!; expect(deadline - r.tick).toBe(10);
    r.nextStrike = 1e9;
    while (r.tick < deadline - 1) stepFoundry(r, miss);
    expect(r.targets).toHaveLength(0); stepFoundry(r, miss); expect(r.targets).toHaveLength(1);
  });
  it("uses the revised family HP while preserving source HP in saved V12 replacements", () => {
    const current = createFoundryRound(41, { ...newFoundryCycle(), orderIndex: 3 }, "mallet");
    const saved = structuredClone(current); saved.version = 12; delete saved.brokenByKind;
    const kinds = new Set<string>();
    for (let index = 0; index < 80; index++) {
      const relic = spawnFoundryRelic(current), previous = spawnFoundryRelic(saved);
      expect(relic.kind).toBe(previous.kind); if (relic.kind === "spring") throw new Error("Unexpected stamina source");
      expect(relic.maxHp).toBe(FOUNDRY_PACING.hp[relic.kind]);
      expect(previous.maxHp).toBe(FOUNDRY_RELIC_PROFILES[relic.kind].hp); kinds.add(relic.kind);
    }
    expect(kinds.size).toBe(4);
  });
  it("counts each destroyed relic once and replays the family recap across checkpoints", () => {
    const current = round(); current.targets.forEach((target) => { target.hp = 1; target.vx = target.vz = 0; });
    current.stats.radius = 20;
    const resumed = structuredClone(current);
    const input = { x: 0, z: 0, active: true };
    expect(stepFoundry(current, input)).toEqual(stepFoundry(resumed, input));
    expect(current.broken).toBe(4); expect(current.brokenByKind).toEqual({ urn: 4 }); expect(resumed).toEqual(current);
    stepFoundry(current, input); expect(current.brokenByKind).toEqual({ urn: 4 });
  });
  it("spawns at the learned 7-second or 5-second interval and caps simultaneous population", () => {
    for (const [skills, ticks] of [[['trickle-spawn'], 140], [['trickle-spawn', 'trickle-spawn-1'], 100]] as const) {
      const r = createFoundryRound(19, { ...newFoundryCycle(), skills: [...skills] }, "mallet");
      r.targets.pop(); r.nextStrike = 1e9;
      while (r.tick < ticks - 1) stepFoundry(r, miss);
      expect(r.targets).toHaveLength(3); stepFoundry(r, miss); expect(r.targets).toHaveLength(4);
      while (r.tick < ticks * 3) stepFoundry(r, miss);
      expect(r.targets).toHaveLength(4); expect(r.rogue!.complete!.pendingSpawns).toBeLessThanOrEqual(4);
    }
  });
  it("uses the on-death chance for one replacement rather than a refill plus an extra relic", () => {
    const r = round(); r.rogue!.complete!.modifiers.respawnChance = 1;
    destroy(r); expect(r.targets).toHaveLength(4); expect(r.broken).toBe(1);
  });
  it("preserves a pending empty-desk timer across a serialized checkpoint", () => {
    const r = round(); r.targets = [r.targets[0]!]; destroy(r); r.nextStrike = 1e9;
    const resumed = JSON.parse(JSON.stringify(r)) as FoundryRound;
    for (let i = 0; i < 20; i++) expect(stepFoundry(resumed, miss)).toEqual(stepFoundry(r, miss));
    expect(resumed).toEqual(r);
  });
  it("matches every mapped loot tier, weight and HP against the imported source data", () => {
    const source = JSON.parse(readFileSync(new URL("../../../docs/references/bills-must-be-paid/build-24759944.json", import.meta.url), "utf8"));
    for (const [kind, profile] of Object.entries(FOUNDRY_RELIC_PROFILES)) {
      const original = source.categories.piggies.items.find((entry: { slug: string }) => entry.slug === profile.source);
      expect(profile.hp).toBe(original.hp); expect(profile.loot.map((tier) => tier.weight)).toEqual(original.loot.map((tier: { share: string }) => Number.parseFloat(tier.share)));
      let cumulative = 0;
      for (const tier of profile.loot) {
        for (const [within, amount] of [[0, tier.min], [0.999999, tier.max]]) {
          const values = [(cumulative + tier.weight / 2) / 100, within!];
          expect(foundryReferenceDrop(kind as keyof typeof FOUNDRY_RELIC_PROFILES, () => values.shift()!)).toEqual({ amount, jackpot: tier.jackpot });
        }
        cumulative += tier.weight;
      }
      expect(cumulative).toBe(100);
    }
  });
  it("pays the source jackpot once without the old deposit multiplier or an automatic doubling", () => {
    const r = round(); r.targets[0]!.glowing = true;
    expect(destroy(r).impacts[0]!.loot).toBe(22); expect(r.shards).toBe(22); expect(r.rogue!.jackpots).toBe(1);
    const legacy = createFoundryRound(19, { ...newFoundryCycle(), economy: 5 }, "mallet");
    legacy.stats.critical = 0; legacy.targets[0]!.glowing = true;
    expect(legacy.version).toBe(11); expect(legacy.targets).toHaveLength(12);
    expect(destroy(legacy).impacts[0]!.loot).toBe(60); expect(legacy.targets).toHaveLength(12);
  });
  it("uses source first-bill amounts while retaining saved V11 chantier prices", () => {
    expect(FOUNDRY_POPULATION.orderCosts).toEqual([20, 45, 200, 750, 1000]);
    expect(foundryOrderCost(newFoundryCycle())).toBe(20);
    expect(foundryOrderCost({ ...newFoundryCycle(), economy: 5 })).toBe(2000);
  });
});
