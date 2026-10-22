import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import {
  cardValidator,
  eventValidator,
  stateValidator,
  rarityValidator,
  lootValidator,
  revealValidator,
} from "./lib/validators";

export default defineSchema({
  collection: defineTable({
    ownerId: v.string(),
    variantId: v.string(),
    level: v.number(),
    copies: v.number(),
  }).index("by_owner_variant", ["ownerId", "variantId"]),
  chests: defineTable({
    ownerId: v.string(),
    gameId: v.id("games"),
    slot: v.number(),
    rarity: rarityValidator,
    status: v.union(v.literal("unopened"), v.literal("opened")),
    awardedAt: v.number(),
    unlockAt: v.number(),
    openedAt: v.optional(v.number()),
    contents: v.array(lootValidator),
    reveals: v.optional(v.array(revealValidator)),
  }).index("by_owner_status", ["ownerId", "status"]),
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
    mode: v.optional(
      v.union(v.literal("solo"), v.literal("public"), v.literal("private")),
    ),
    reward: v.optional(
      v.object({
        ownerId: v.string(),
        status: v.union(v.literal("awarded"), v.literal("lost")),
        chestId: v.optional(v.id("chests")),
        rarity: v.optional(rarityValidator),
      }),
    ),
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
