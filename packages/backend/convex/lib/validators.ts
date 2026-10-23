import { v } from "convex/values";

export const summonPackValidator = v.union(
  v.literal("sylve"),
  v.literal("ancients"),
);
export const summonCountValidator = v.union(v.literal(1), v.literal(10));

export const rarityValidator = v.union(
  v.literal("common"),
  v.literal("rare"),
  v.literal("epic"),
  v.literal("legendary"),
);
export const lootValidator = v.object({
  variantId: v.string(),
  count: v.number(),
});
export const revealValidator = v.object({
  variantId: v.string(),
  count: v.number(),
  isNew: v.boolean(),
  level: v.number(),
  copies: v.number(),
});

const abilityValidator = v.object({
  id: v.string(),
  name: v.string(),
  description: v.string(),
  unlockLevel: v.number(),
  active: v.boolean(),
  value: v.number(),
  effect: v.union(
    v.literal("attack"),
    v.literal("health"),
    v.literal("heal"),
    v.literal("block"),
    v.literal("spikes"),
    v.literal("vampirism"),
    v.literal("regeneration"),
    v.literal("shield"),
    v.literal("extra_attack"),
    v.literal("pierce"),
    v.literal("rune"),
    v.literal("summon"),
    v.literal("attack_per_ally"),
  ),
  trigger: v.union(
    v.literal("deploy"),
    v.literal("turn_start"),
    v.literal("nature_ally_appears"),
    v.literal("death"),
    v.literal("enemy_hero_attacked"),
    v.literal("passive"),
  ),
  target: v.union(
    v.literal("self"),
    v.literal("random_ally"),
    v.literal("column_allies"),
    v.literal("row_allies"),
    v.literal("melee_allies"),
    v.literal("nature_allies"),
    v.literal("order_allies"),
    v.literal("all_allies"),
    v.literal("all_enemies"),
    v.literal("ally_hero"),
    v.literal("ally_buildings"),
    v.literal("random_zombie"),
  ),
  temporary: v.optional(v.boolean()),
  summon: v.optional(
    v.object({
      kind: v.union(v.literal("archer"), v.literal("zombie")),
      attack: v.number(),
      health: v.number(),
      level: v.number(),
    }),
  ),
});
export const cardValidator = v.object({
  id: v.string(),
  name: v.string(),
  title: v.string(),
  attack: v.number(),
  health: v.number(),
  color: v.string(),
  kind: v.string(),
  combatType: v.optional(
    v.union(v.literal("melee"), v.literal("ranged"), v.literal("building")),
  ),
  faction: v.optional(
    v.union(v.literal("order"), v.literal("nature"), v.literal("chaos")),
  ),
  sourceHero: v.optional(v.string()),
  abilities: v.optional(v.array(abilityValidator)),
  baseId: v.optional(v.string()),
  rarity: v.optional(rarityValidator),
  level: v.optional(v.number()),
});
const unitValidator = v.object({
  cardId: v.string(),
  row: v.number(),
  depth: v.number(),
  hp: v.number(),
  attack: v.optional(v.number()),
  maxHp: v.optional(v.number()),
  block: v.optional(v.number()),
  spikes: v.optional(v.number()),
  vampirism: v.optional(v.number()),
  regeneration: v.optional(v.number()),
  shield: v.optional(v.boolean()),
  temporaryAttack: v.optional(v.number()),
  definition: v.optional(cardValidator),
});
const runeValidator = v.object({
  row: v.number(),
  depth: v.number(),
  health: v.number(),
});
export const stateValidator = v.object({
  players: v.array(
    v.object({
      userId: v.string(),
      name: v.string(),
      heroHp: v.number(),
      cards: v.array(cardValidator),
      hand: v.array(v.string()),
      drawPile: v.array(v.string()),
      discard: v.array(v.string()),
      board: v.array(unitValidator),
      runes: v.optional(v.array(runeValidator)),
    }),
  ),
  activePlayer: v.number(),
  turn: v.number(),
  hasSummoned: v.boolean(),
  status: v.union(v.literal("active"), v.literal("finished")),
  winner: v.union(v.number(), v.null()),
  turnEndsAt: v.number(),
  sequence: v.number(),
});
export const eventValidator = v.object({
  seq: v.number(),
  type: v.union(
    v.literal("summon"),
    v.literal("withdraw"),
    v.literal("attack"),
    v.literal("death"),
    v.literal("turn"),
    v.literal("victory"),
    v.literal("ability"),
  ),
  player: v.number(),
  cardId: v.optional(v.string()),
  row: v.optional(v.number()),
  depth: v.optional(v.number()),
  targetPlayer: v.optional(v.number()),
  targetCardId: v.optional(v.string()),
  targetRow: v.optional(v.number()),
  targetDepth: v.optional(v.number()),
  damage: v.optional(v.number()),
  hp: v.optional(v.number()),
  ability: v.optional(v.string()),
  amount: v.optional(v.number()),
  unit: v.optional(unitValidator),
  runes: v.optional(v.array(runeValidator)),
});
