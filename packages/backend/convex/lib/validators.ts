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

export const cardValidator = v.object({
  id: v.string(),
  name: v.string(),
  title: v.string(),
  attack: v.number(),
  health: v.number(),
  color: v.string(),
  kind: v.string(),
  combatType: v.optional(v.union(v.literal("melee"), v.literal("ranged"))),
  baseId: v.optional(v.string()),
  rarity: v.optional(rarityValidator),
  level: v.optional(v.number()),
});
const unitValidator = v.object({
  cardId: v.string(),
  row: v.number(),
  depth: v.number(),
  hp: v.number(),
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
});
