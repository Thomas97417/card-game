import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import {
  cardValidator,
  eventValidator,
  stateValidator,
} from "./lib/validators";

export default defineSchema({
  decks: defineTable({
    ownerId: v.string(),
    name: v.string(),
    cardIds: v.array(v.string()),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]),
  activities: defineTable({
    userId: v.string(),
    gameId: v.optional(v.id("games")),
    queueId: v.optional(v.id("matchmakingQueue")),
  }).index("by_user", ["userId"]),
  games: defineTable({
    status: v.union(
      v.literal("waiting"),
      v.literal("active"),
      v.literal("finished"),
      v.literal("cancelled"),
    ),
    hostId: v.string(),
    hostName: v.string(),
    hostCards: v.array(cardValidator),
    guestId: v.optional(v.string()),
    inviteCode: v.optional(v.string()),
    waitingExpiresAt: v.optional(v.number()),
    state: v.optional(stateValidator),
  }).index("by_code", ["inviteCode"]),
  gameEvents: defineTable({
    gameId: v.id("games"),
    seq: v.number(),
    event: eventValidator,
  }).index("by_game_seq", ["gameId", "seq"]),
  matchmakingQueue: defineTable({
    userId: v.string(),
    name: v.string(),
    cards: v.array(cardValidator),
    expiresAt: v.number(),
  }).index("by_user", ["userId"]),
});
