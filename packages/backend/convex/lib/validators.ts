import { v } from "convex/values";

export const cardValidator = v.object({
  id: v.string(),
  name: v.string(),
  title: v.string(),
  attack: v.number(),
  health: v.number(),
  color: v.string(),
  kind: v.string(),
  combatType: v.optional(v.union(v.literal("melee"), v.literal("ranged"))),
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
  damage: v.optional(v.number()),
  hp: v.optional(v.number()),
});
