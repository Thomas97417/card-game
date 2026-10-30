import { v } from "convex/values";
import { BLESSING_IDS, FOUNDRY_SKILL_IDS, FOUNDRY_CHARM_IDS, FOUNDRY_MODIFIERS, FOUNDRY_REFERENCE_MODIFIERS, TOOL_IDS, type FoundryModifiers, type FoundryReferenceModifiers } from "@sylve/game/foundry";
export const foundryTool = v.union(...TOOL_IDS.map((id) => v.literal(id)));
export const foundryAssistant = v.union(v.literal("smith"), v.literal("dryad"), v.literal("feline"));
export const foundryUpgrade = v.union(v.literal("power"), v.literal("focus"), v.literal("fortune"));
export const foundryBlessing = v.union(...BLESSING_IDS.map((id) => v.literal(id)));
export const foundrySkill = v.union(...FOUNDRY_SKILL_IDS.map((id) => v.literal(id)));
export const foundryCharm = v.union(...FOUNDRY_CHARM_IDS.map((id) => v.literal(id)));
const modifierShape = Object.fromEntries(Object.keys(FOUNDRY_MODIFIERS).map((key) => [key, v.number()])) as { [K in keyof FoundryModifiers]: ReturnType<typeof v.number> };
const referenceShape = Object.fromEntries(Object.keys(FOUNDRY_REFERENCE_MODIFIERS).map((key) => [key, v.number()])) as { [K in keyof FoundryReferenceModifiers]: ReturnType<typeof v.number> };
const relicKind = v.union(v.literal("urn"), v.literal("geode"), v.literal("runner"), v.literal("spring"), v.literal("chaos"));
export const foundryInput = v.object({ x: v.number(), z: v.number(), active: v.boolean() });
export const foundryCycle = v.object({
  number: v.number(), shards: v.number(), orderIndex: v.number(), roundsLeft: v.number(),
  upgrades: v.object({ power: v.number(), focus: v.number(), fortune: v.number() }),
  blessings: v.array(foundryBlessing), choices: v.array(foundryBlessing),
  skills: v.optional(v.array(foundrySkill)), seed: v.optional(v.number()), economy: v.optional(v.union(v.literal(2), v.literal(3), v.literal(4))),
  purchasedTools: v.optional(v.array(foundryTool)), selectedTool: v.optional(foundryTool),
  status: v.union(v.literal("active"), v.literal("failed"), v.literal("completed"), v.literal("abandoned")),
});
export const foundrySummary = v.object({ shards: v.number(), broken: v.number(), hits: v.number(), criticals: v.number(), seconds: v.number() });
export const foundryRound = v.object({
  version: v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4), v.literal(5), v.literal(6), v.literal(7), v.literal(8), v.literal(9), v.literal(10)), rng: v.number(), nextId: v.number(), tick: v.number(), concentration: v.number(),
  stats: v.object({ damage: v.number(), interval: v.number(), radius: v.number(), critical: v.number(), loot: v.number(), concentration: v.number(), stamina: v.optional(v.number()) }),
  tool: foundryTool, assistant: foundryAssistant, nextStrike: v.number(), shards: v.number(), broken: v.number(), hits: v.number(), criticals: v.number(), ended: v.boolean(),
  rogue: v.optional(v.object({ modifiers: v.object(modifierShape), capacity: v.number(), pressure: v.number(), frenzyUntil: v.number(), frozenUntil: v.number(), nextFreeze: v.number(), strikes: v.number(), jackpots: v.number(), wealth: v.optional(v.number()), recoveryReserve: v.optional(v.number()),
    reference: v.optional(v.object({ modifiers: v.object(referenceShape), spent: v.number(), combo: v.number(), previousKind: v.optional(relicKind), firstHitUsed: v.boolean() })),
    burns: v.array(v.object({ id: v.number(), until: v.number(), next: v.number() })) })),
  targets: v.array(v.object({ id: v.number(), kind: v.union(v.literal("urn"), v.literal("geode"), v.literal("runner"), v.literal("spring"), v.literal("chaos")),
    x: v.number(), z: v.number(), hp: v.number(), maxHp: v.number(), vx: v.number(), vz: v.number(), phase: v.number(), glowing: v.optional(v.boolean()) })),
});
