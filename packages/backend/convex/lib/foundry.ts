import { v } from "convex/values";
export const foundryTool = v.union(v.literal("mallet"), v.literal("swift"), v.literal("resonance"));
export const foundryAssistant = v.union(v.literal("smith"), v.literal("dryad"), v.literal("feline"));
export const foundryUpgrade = v.union(v.literal("power"), v.literal("focus"), v.literal("fortune"));
export const foundryBlessing = v.union(v.literal("power"), v.literal("cadence"), v.literal("focus"), v.literal("reach"), v.literal("loot"), v.literal("critical"));
export const foundryInput = v.object({ x: v.number(), z: v.number(), active: v.boolean() });
export const foundryCycle = v.object({
  number: v.number(), shards: v.number(), orderIndex: v.number(), roundsLeft: v.number(),
  upgrades: v.object({ power: v.number(), focus: v.number(), fortune: v.number() }),
  blessings: v.array(foundryBlessing), choices: v.array(foundryBlessing),
  status: v.union(v.literal("active"), v.literal("failed"), v.literal("completed")),
});
export const foundrySummary = v.object({ shards: v.number(), broken: v.number(), hits: v.number(), criticals: v.number(), seconds: v.number() });
export const foundryRound = v.object({
  version: v.literal(1), rng: v.number(), nextId: v.number(), tick: v.number(), concentration: v.number(),
  stats: v.object({ damage: v.number(), interval: v.number(), radius: v.number(), critical: v.number(), loot: v.number(), concentration: v.number() }),
  tool: foundryTool, assistant: foundryAssistant, nextStrike: v.number(), shards: v.number(), broken: v.number(), hits: v.number(), criticals: v.number(), ended: v.boolean(),
  targets: v.array(v.object({ id: v.number(), kind: v.union(v.literal("urn"), v.literal("geode"), v.literal("runner"), v.literal("spring"), v.literal("chaos")),
    x: v.number(), z: v.number(), hp: v.number(), maxHp: v.number(), vx: v.number(), vz: v.number(), phase: v.number() })),
});
