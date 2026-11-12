import { v } from "convex/values";
import { WEAPON_IDS, PASSIVE_IDS, UPGRADE_IDS } from "@sylve/game/cemetery";
import { heroIdValidator } from "./validators";
export const cemeteryWeaponId = v.union(
  ...WEAPON_IDS.map((id) => v.literal(id)),
);
export const cemeteryPassiveId = v.union(
  ...PASSIVE_IDS.map((id) => v.literal(id)),
);
export const cemeteryUpgradeId = v.union(
  ...UPGRADE_IDS.map((id) => v.literal(id)),
);
export const cemeteryUpgrades = v.object(
  Object.fromEntries(
    UPGRADE_IDS.map((id) => [id, v.optional(v.number())]),
  ) as Record<
    (typeof UPGRADE_IDS)[number],
    ReturnType<typeof v.optional<ReturnType<typeof v.number>>>
  >,
);
export const cemeteryInput = v.object({ x: v.number(), y: v.number() });
export const cemeterySummary = v.object({
  seconds: v.number(),
  level: v.number(),
  kills: v.number(),
  bosses: v.number(),
  gold: v.number(),
  rarity: v.union(
    v.literal("common"),
    v.literal("rare"),
    v.literal("bigRare"),
    v.literal("epic"),
    v.literal("legendary"),
  ),
});
export const cemeteryState = v.object({
  version: v.literal(1),
  seed: v.number(),
  tick: v.number(),
  heroId: heroIdValidator,
  x: v.number(),
  y: v.number(),
  facingX: v.number(),
  facingY: v.number(),
  health: v.number(),
  shield: v.number(),
  lastHit: v.number(),
  invulnerableUntil: v.number(),
  revivalsLeft: v.number(),
  revivalsUsed: v.number(),
  revivalExhausted: v.boolean(),
  soulHealing: v.number(),
  lifeStealUntil: v.number(),
  level: v.number(),
  xp: v.number(),
  nextXp: v.number(),
  gold: v.number(),
  kills: v.number(),
  bosses: v.number(),
  upgrades: cemeteryUpgrades,
  weapons: v.array(
    v.object({
      id: cemeteryWeaponId,
      level: v.number(),
      evolved: v.boolean(),
      nextAttack: v.number(),
    }),
  ),
  passives: v.array(v.object({ id: cemeteryPassiveId, level: v.number() })),
  choices: v.array(v.string()),
  choiceSerial: v.number(),
  spawnBudget: v.number(),
  spawnedBosses: v.number(),
  nextId: v.number(),
  ended: v.boolean(),
  enemies: v.array(
    v.object({
      id: v.number(),
      kind: v.union(
        v.literal("revenant"),
        v.literal("bat"),
        v.literal("skeleton"),
        v.literal("specter"),
        v.literal("guard"),
        v.literal("boss"),
      ),
      x: v.number(),
      y: v.number(),
      hp: v.number(),
      maxHp: v.number(),
      damage: v.number(),
      speed: v.number(),
      radius: v.number(),
      born: v.number(),
      knockback: v.number(),
    }),
  ),
  pickups: v.array(
    v.object({
      id: v.number(),
      kind: v.union(
        v.literal("xp"),
        v.literal("gold"),
        v.literal("heal"),
        v.literal("vacuum"),
        v.literal("relic"),
      ),
      x: v.number(),
      y: v.number(),
      value: v.number(),
      eligible: v.boolean(),
    }),
  ),
  projectiles: v.array(
    v.object({
      id: v.number(),
      weapon: cemeteryWeaponId,
      mode: v.union(
        v.literal("line"),
        v.literal("arc"),
        v.literal("boomerang"),
        v.literal("bounce"),
        v.literal("orbit"),
        v.literal("zone"),
        v.literal("bolt"),
        v.literal("slash"),
        v.literal("blast"),
      ),
      x: v.number(),
      y: v.number(),
      vx: v.number(),
      vy: v.number(),
      damage: v.number(),
      radius: v.number(),
      age: v.number(),
      life: v.number(),
      delay: v.number(),
      remaining: v.number(),
      pulseAt: v.number(),
      hits: v.array(v.number()),
      angle: v.number(),
      orbit: v.number(),
      hitDelay: v.number(),
      evolved: v.boolean(),
      critical: v.boolean(),
    }),
  ),
});
