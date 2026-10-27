import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { missionStateFields } from "./lib/missions";

const mineState = v.object({
  amount: v.number(),
  updatedAt: v.number(),
  heroLevel: v.number(),
  revision: v.number(),
});

import {
  cardValidator,
  heroIdValidator,
  eventValidator,
  stateValidator,
  chestTypeValidator,
  lootValidator,
  revealValidator,
  summonPackValidator,
  summonCountValidator,
  goldPackValidator,
} from "./lib/validators";

export default defineSchema({
  heroes: defineTable({
    ownerId: v.string(),
    level: v.number(),
    peakMight: v.number(),
    selectedHeroId: v.optional(heroIdValidator),
    unlockedHeroIds: v.optional(v.array(heroIdValidator)),
  }).index("by_owner", ["ownerId"]),
  missionProgress: defineTable({
    ownerId: v.string(),
    ...missionStateFields,
  }).index("by_owner", ["ownerId"]),
  dailyRewards: defineTable({
    ownerId: v.string(),
    claims: v.array(
      v.object({
        day: v.number(),
        claimedAt: v.number(),
        gold: v.number(),
        emeralds: v.number(),
        rarity: v.optional(chestTypeValidator),
        reveals: v.array(revealValidator),
      }),
    ),
  }).index("by_owner", ["ownerId"]),
  worldMessages: defineTable({
    senderId: v.string(),
    senderName: v.string(),
    body: v.string(),
  }).index("by_sender", ["senderId"]),
  friendships: defineTable({
    playerA: v.string(),
    playerB: v.string(),
    requestedBy: v.string(),
    status: v.union(v.literal("pending"), v.literal("accepted")),
  })
    .index("by_pair", ["playerA", "playerB"])
    .index("by_a_status", ["playerA", "status"])
    .index("by_b_status", ["playerB", "status"]),
  friendHelp: defineTable({
    senderId: v.string(),
    recipientId: v.string(),
    day: v.string(),
  }).index("by_sender_day_recipient", ["senderId", "day", "recipientId"]),
  friendMessages: defineTable({
    playerA: v.string(),
    playerB: v.string(),
    senderId: v.string(),
    body: v.string(),
  })
    .index("by_pair", ["playerA", "playerB"])
    .index("by_sender", ["senderId"]),
  leagueProgress: defineTable({
    ownerId: v.string(),
    trophies: v.number(),
    peakTrophies: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_trophies", ["trophies"]),
  wallets: defineTable({
    ownerId: v.string(),
    gold: v.number(),
    soulDust: v.optional(v.number()),
    experience: v.optional(v.number()),
    catalogueVersion: v.optional(v.literal(2)),
    diamonds: v.optional(v.number()),
    friendshipTokens: v.optional(v.number()),
    mines: v.optional(v.object({ gold: mineState, emeralds: mineState })),
    activeSummonId: v.optional(v.id("summons")),
  }).index("by_owner", ["ownerId"]),
  emeraldPurchases: defineTable({
    ownerId: v.string(),
    checkoutId: v.string(),
    customerId: v.string(),
    productId: v.string(),
    packId: v.string(),
    emeralds: v.number(),
    priceAmount: v.number(),
    priceCurrency: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("refunded"),
    ),
    orderId: v.optional(v.string()),
    creditedEmeralds: v.number(),
    refundedEmeralds: v.number(),
  })
    .index("by_checkout", ["checkoutId"])
    .index("by_order", ["orderId"])
    .index("by_owner", ["ownerId"]),
  goldPurchases: defineTable({
    ownerId: v.string(),
    requestId: v.string(),
    packId: goldPackValidator,
    gold: v.number(),
    cost: v.number(),
  }).index("by_owner_request", ["ownerId", "requestId"]),
  chestSlotUnlocks: defineTable({
    ownerId: v.string(),
    slot: v.number(),
    cost: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_slot", ["ownerId", "slot"]),
  summons: defineTable({
    ownerId: v.string(),
    requestId: v.string(),
    packId: summonPackValidator,
    count: summonCountValidator,
    cost: v.number(),
    reveals: v.array(revealValidator),
    gold: v.optional(v.number()),
    goldBySummon: v.optional(v.array(v.number())),
    revealProgress: v.optional(
      v.object({ round: v.number(), revealed: v.array(v.number()) }),
    ),
    revealCompleted: v.optional(v.boolean()),
  })
    .index("by_owner_request", ["ownerId", "requestId"])
    .index("by_owner_reveal", ["ownerId", "revealCompleted"])
    .index("by_owner", ["ownerId"]),
  victoryChests: defineTable({
    ownerId: v.string(),
    wins: v.number(),
    cycle: v.number(),
    contents: v.array(lootValidator),
    gold: v.optional(v.number()),
    rewardVersion: v.optional(v.union(v.literal(2), v.literal(3))),
    leagueTrophies: v.optional(v.number()),
    lastClaim: v.optional(
      v.object({
        cycle: v.number(),
        reveals: v.array(revealValidator),
        gold: v.optional(v.number()),
      }),
    ),
  }).index("by_owner", ["ownerId"]),
  collection: defineTable({
    ownerId: v.string(),
    variantId: v.string(),
    level: v.number(),
    copies: v.number(),
    soulbinds: v.optional(v.array(v.number())),
  }).index("by_owner_variant", ["ownerId", "variantId"]),
  chests: defineTable({
    ownerId: v.string(),
    gameId: v.id("games"),
    slot: v.number(),
    rarity: chestTypeValidator,
    status: v.union(v.literal("unopened"), v.literal("opened")),
    awardedAt: v.number(),
    unlockAt: v.number(),
    openedAt: v.optional(v.number()),
    contents: v.array(lootValidator),
    gold: v.optional(v.number()),
    reveals: v.optional(v.array(revealValidator)),
    rewardVersion: v.optional(v.union(v.literal(2), v.literal(3))),
    leagueTrophies: v.optional(v.number()),
    instantCost: v.optional(v.number()),
    emeraldsSpent: v.optional(v.number()),
  }).index("by_owner_status", ["ownerId", "status"]),
  chestPools: defineTable({
    ownerId: v.string(),
    leagueIndex: v.number(),
    version: v.optional(v.literal(1)),
    remaining: v.object({
      common: v.number(),
      rare: v.number(),
      bigRare: v.number(),
      epic: v.number(),
      legendary: v.number(),
    }),
  }).index("by_owner_league", ["ownerId", "leagueIndex"]),
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
    soloRecentCards: v.optional(v.array(v.string())),
    trophyChanges: v.optional(
      v.array(
        v.object({
          ownerId: v.string(),
          trophies: v.number(),
          trophiesTotal: v.number(),
          previousTrophies: v.number(),
          previousPeakTrophies: v.optional(v.number()),
          deckCapacity: v.number(),
          deckSlotsGained: v.number(),
        }),
      ),
    ),
    mode: v.optional(
      v.union(v.literal("solo"), v.literal("public"), v.literal("private")),
    ),
    reward: v.optional(
      v.object({
        ownerId: v.string(),
        status: v.union(v.literal("awarded"), v.literal("lost")),
        chestId: v.optional(v.id("chests")),
        rarity: v.optional(chestTypeValidator),
        victoryWins: v.optional(v.number()),
        trophies: v.optional(v.number()),
        trophiesTotal: v.optional(v.number()),
        previousTrophies: v.optional(v.number()),
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
    hostHeroLevel: v.optional(v.number()),
    hostHeroId: v.optional(heroIdValidator),
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
    heroLevel: v.optional(v.number()),
    heroId: v.optional(heroIdValidator),
    expiresAt: v.number(),
  }).index("by_user", ["userId"]),
});
