import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { requirePlayer, rules } from "./lib/game_service";
import { ownedCard, playerLeague, playerWallet } from "./lib/progression";
import { catalogueMigration, canonicalVariantId, resolveCard } from "@sylve/game";
import { cardRequestLimits, isRequestableRarity } from "@sylve/game/card-requests";
import { migratePlayerCatalogue } from "./lib/catalogue";
import { FRIEND_HELP_EXPERIENCE, FRIENDS_UNLOCK_RANK } from "@sylve/game/ranks";
import { leagueAt } from "@sylve/game/leagues";
import { addRankExperience, readRank } from "./lib/ranks";
import {
  FRIEND_HELP_TOKENS,
  friendship,
  friendshipPair,
  playerFriendships,
  requireFriend,
  socialDay,
} from "./lib/social";

export const balance = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requirePlayer(ctx);
    return (await playerWallet(ctx, userId))?.friendshipTokens ?? 0;
  },
});

export const list = query({
  args: { refreshDay: v.optional(v.string()) },
  handler: async (ctx) => {
    const { userId } = await requirePlayer(ctx);
    const day = socialDay();
    const [accepted, pending, help, wallet, rank] = await Promise.all([
      playerFriendships(ctx, userId, "accepted"),
      playerFriendships(ctx, userId, "pending"),
      ctx.db
        .query("friendHelp")
        .withIndex("by_sender_day_recipient", (q) =>
          q.eq("senderId", userId).eq("day", day),
        )
        .collect(),
      playerWallet(ctx, userId),
      readRank(ctx, userId),
    ]);
    const helped = new Set(help.map((item) => item.recipientId));
    const players = await Promise.all(
      [...accepted, ...pending].map(async (relation) => {
        const playerId =
          relation.playerA === userId ? relation.playerB : relation.playerA;
        const user = await authComponent.getAnyUserById(ctx, playerId);
        if (!user) return null;
        const league = await playerLeague(ctx, playerId);
        return {
          playerId,
          name: user.name,
          trophies: league.trophies,
          status: relation.status,
          incoming: relation.requestedBy !== userId,
          helpSent: helped.has(playerId),
        };
      }),
    );
    const available = players
      .filter((item) => item !== null)
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return {
      friends: available.filter((item) => item.status === "accepted"),
      incoming: available.filter(
        (item) => item.status === "pending" && item.incoming,
      ),
      outgoing: available.filter(
        (item) => item.status === "pending" && !item.incoming,
      ),
      limit: rank.friends,
      rank: rank.rank,
      nextUnlock: rank.nextFriends,
      tokens: wallet?.friendshipTokens ?? 0,
      day,
    };
  },
});

export const relationship = query({
  args: { playerId: v.string() },
  handler: async (ctx, { playerId }) => {
    const { userId } = await requirePlayer(ctx);
    if (playerId === userId) return "self" as const;
    const relation = await friendship(ctx, userId, playerId);
    if (!relation) return "none" as const;
    if (relation.status === "accepted") return "friend" as const;
    return relation.requestedBy === userId
      ? ("outgoing" as const)
      : ("incoming" as const);
  },
});

export const request = mutation({
  args: { playerId: v.string() },
  handler: async (ctx, { playerId }) => {
    const { userId } = await requirePlayer(ctx);
    if (userId === playerId)
      throw new ConvexError("Tu ne peux pas t’ajouter toi-même.");
    const user = await authComponent.getAnyUserById(ctx, playerId);
    if (!user) throw new ConvexError("Ce gardien est introuvable.");
    // Canonical pairs make retries and crossed requests idempotent.
    const previous = await friendship(ctx, userId, playerId);
    if (previous) return;
    const [own, other, pending, ownRank, otherRank] = await Promise.all([
      playerFriendships(ctx, userId, "accepted"),
      playerFriendships(ctx, playerId, "accepted"),
      playerFriendships(ctx, userId, "pending"),
      readRank(ctx, userId),
      readRank(ctx, playerId),
    ]);
    requireFriendSlot(own.length, ownRank.friends, true);
    requireFriendSlot(other.length, otherRank.friends, false);
    if (
      pending.filter((item) => item.requestedBy === userId).length >=
      ownRank.friends
    )
      throw new ConvexError(`Tu as déjà ${ownRank.friends} demandes en attente.`);
    await ctx.db.insert("friendships", {
      ...friendshipPair(userId, playerId),
      requestedBy: userId,
      status: "pending",
    });
  },
});

export const accept = mutation({
  args: { playerId: v.string() },
  handler: async (ctx, { playerId }) => {
    const { userId } = await requirePlayer(ctx);
    const relation = await friendship(ctx, userId, playerId);
    if (!relation)
      throw new ConvexError("Cette demande n’est plus disponible.");
    if (relation.status === "accepted") return;
    if (relation.requestedBy === userId)
      throw new ConvexError("Ce gardien doit accepter ta demande.");
    const [own, other, ownRank, otherRank] = await Promise.all([
      playerFriendships(ctx, userId, "accepted"),
      playerFriendships(ctx, playerId, "accepted"),
      readRank(ctx, userId),
      readRank(ctx, playerId),
    ]);
    // Both indexed reads participate in the transaction: concurrent acceptances
    // cannot exceed the cap on either player's list.
    requireFriendSlot(own.length, ownRank.friends, true);
    requireFriendSlot(other.length, otherRank.friends, false);
    await ctx.db.patch(relation._id, { status: "accepted" });
  },
});

/** Also declines received requests and cancels sent requests. */
export const remove = mutation({
  args: { playerId: v.string() },
  handler: async (ctx, { playerId }) => {
    const { userId } = await requirePlayer(ctx);
    const relation = await friendship(ctx, userId, playerId);
    if (relation) await ctx.db.delete(relation._id);
  },
});

export const sendHelp = mutation({
  args: { playerId: v.string() },
  handler: async (ctx, { playerId }) => {
    const { userId } = await requirePlayer(ctx);
    await requireFriend(ctx, userId, playerId);
    const day = socialDay();
    const previous = await ctx.db
      .query("friendHelp")
      .withIndex("by_sender_day_recipient", (q) =>
        q.eq("senderId", userId).eq("day", day).eq("recipientId", playerId),
      )
      .unique();
    if (previous) return { sent: false, tokens: FRIEND_HELP_TOKENS, experience: 0 };
    const user = await authComponent.getAnyUserById(ctx, playerId);
    if (!user) throw new ConvexError("Ce gardien est introuvable.");
    const wallet = await playerWallet(ctx, playerId);
    if (wallet)
      await ctx.db.patch(wallet._id, {
        friendshipTokens: (wallet.friendshipTokens ?? 0) + FRIEND_HELP_TOKENS,
      });
    else
      await ctx.db.insert("wallets", {
        ownerId: playerId,
        gold: 0,
        friendshipTokens: FRIEND_HELP_TOKENS,
      });
    // Kept independently of the friendship, so removing/re-adding cannot farm help.
    await ctx.db.insert("friendHelp", {
      senderId: userId,
      recipientId: playerId,
      day,
    });
    await addRankExperience(ctx, userId, FRIEND_HELP_EXPERIENCE);
    return { sent: true, tokens: FRIEND_HELP_TOKENS, experience: FRIEND_HELP_EXPERIENCE };
  },
});

/** refreshDay invalidates open clients; the server alone decides the current day. */
export const cardRequestStatus = query({
  args: { refreshDay: v.optional(v.string()) },
  handler: async (ctx) => {
    const { userId } = await requirePlayer(ctx);
    const day = socialDay();
    const [rank, league, friends, request] = await Promise.all([
      readRank(ctx, userId),
      playerLeague(ctx, userId),
      playerFriendships(ctx, userId, "accepted"),
      ctx.db
        .query("cardRequests")
        .withIndex("by_owner_day", (q) =>
          q.eq("ownerId", userId).eq("day", day),
        )
        .unique(),
    ]);
    return {
      day,
      unlocked: rank.friends > 0,
      friendCount: friends.length,
      leagueLabel: leagueAt(league.peakTrophies).label,
      limits: cardRequestLimits(league.peakTrophies),
      request: request
        ? {
            id: request._id,
            variantId: request.variantId,
            requested: request.requested,
            received: request.received,
          }
        : null,
    };
  },
});

export const requestCards = mutation({
  args: { variantId: v.string() },
  handler: async (ctx, { variantId }) => {
    const { userId } = await requirePlayer(ctx);
    variantId = canonicalVariantId(variantId);
    const card = rules(() => resolveCard(variantId));
    if (!isRequestableRarity(card.rarity))
      throw new ConvexError(
        "Tu peux demander uniquement des cartes communes ou rares.",
      );
    const day = socialDay();
    const previous = await ctx.db
      .query("cardRequests")
      .withIndex("by_owner_day", (q) => q.eq("ownerId", userId).eq("day", day))
      .unique();
    // Keep completed requests too: neither completion nor retries grant another one.
    if (previous) {
      if (previous.variantId === variantId) return previous._id;
      throw new ConvexError(
        "Tu as déjà demandé des cartes aujourd’hui. Reviens après minuit (heure de Paris).",
      );
    }
    const rank = await readRank(ctx, userId);
    if (rank.friends === 0)
      throw new ConvexError(
        `Les demandes de cartes se débloquent avec les amis au rang ${FRIENDS_UNLOCK_RANK}.`,
      );
    await migratePlayerCatalogue(ctx, userId);
    if (!(await ownedCard(ctx, userId, variantId)))
      throw new ConvexError(
        "Découvre cette carte avant de la demander à tes amis.",
      );
    const league = await playerLeague(ctx, userId);
    return ctx.db.insert("cardRequests", {
      ownerId: userId,
      day,
      variantId,
      requested: cardRequestLimits(league.peakTrophies)[card.rarity].request,
      received: 0,
    });
  },
});

/** Only accepted friends' requests are exposed, with the viewer's live reserves. */
export const cardRequests = query({
  args: { refreshDay: v.optional(v.string()) },
  handler: async (ctx) => {
    const { userId } = await requirePlayer(ctx);
    const day = socialDay();
    const [friends, league, collection] = await Promise.all([
      playerFriendships(ctx, userId, "accepted"),
      playerLeague(ctx, userId),
      ctx.db
        .query("collection")
        .withIndex("by_owner_variant", (q) => q.eq("ownerId", userId))
        .collect(),
    ]);
    const owned = new Map(
      catalogueMigration(collection).cards.map((entry) => [
        entry.variantId,
        entry.copies,
      ]),
    );
    const limits = cardRequestLimits(league.peakTrophies);
    const requests = await Promise.all(
      friends.map(async (relation) => {
        const playerId =
          relation.playerA === userId ? relation.playerB : relation.playerA;
        const request = await ctx.db
          .query("cardRequests")
          .withIndex("by_owner_day", (q) =>
            q.eq("ownerId", playerId).eq("day", day),
          )
          .unique();
        if (!request) return null;
        const [user, donation] = await Promise.all([
          authComponent.getAnyUserById(ctx, playerId),
          ctx.db
            .query("cardDonations")
            .withIndex("by_request_sender", (q) =>
              q.eq("requestId", request._id).eq("senderId", userId),
            )
            .unique(),
        ]);
        const card = resolveCard(request.variantId);
        if (!user || !isRequestableRarity(card.rarity)) return null;
        const donated = donation?.count ?? 0;
        const copies = owned.get(request.variantId) ?? 0;
        const limit = limits[card.rarity];
        return {
          id: request._id,
          playerId,
          playerName: user.name,
          variantId: request.variantId,
          requested: request.requested,
          received: request.received,
          donated,
          copies,
          donationLimit: limit.donate,
          experiencePerCard: limit.experience,
          sendable: Math.max(
            0,
            Math.min(
              copies,
              request.requested - request.received,
              limit.donate - donated,
            ),
          ),
        };
      }),
    );
    return requests
      .filter((request) => request !== null)
      .sort(
        (a, b) =>
          Number(b.sendable > 0) - Number(a.sendable > 0) ||
          a.playerName.localeCompare(b.playerName, "fr"),
      );
  },
});

export const donateCards = mutation({
  args: {
    requestId: v.id("cardRequests"),
    count: v.number(),
    expectedDonated: v.number(),
  },
  handler: async (ctx, { requestId, count, expectedDonated }) => {
    const { userId } = await requirePlayer(ctx);
    if (
      !Number.isSafeInteger(count) ||
      count <= 0 ||
      !Number.isSafeInteger(expectedDonated) ||
      expectedDonated < 0
    )
      throw new ConvexError("Quantité de cartes invalide.");
    const request = await ctx.db.get(requestId);
    if (!request || request.day !== socialDay())
      throw new ConvexError("Cette demande de cartes a expiré.");
    if (request.ownerId === userId)
      throw new ConvexError("Tu ne peux pas répondre à ta propre demande.");
    await requireFriend(ctx, userId, request.ownerId);
    const donation = await ctx.db
      .query("cardDonations")
      .withIndex("by_request_sender", (q) =>
        q.eq("requestId", requestId).eq("senderId", userId),
      )
      .unique();
    const donated = donation?.count ?? 0;
    // An identical click or transport retry must never transfer or award XP twice.
    if (donated > expectedDonated)
      return { sent: false, count: 0, experience: 0 };
    if (donated !== expectedDonated)
      throw new ConvexError("Tes dons ont changé. Actualise cette demande.");
    const card = rules(() => resolveCard(request.variantId));
    if (!isRequestableRarity(card.rarity))
      throw new ConvexError(
        "Tu peux envoyer uniquement des cartes communes ou rares.",
      );
    const league = await playerLeague(ctx, userId);
    const limit = cardRequestLimits(league.peakTrophies)[card.rarity];
    if (donated + count > limit.donate)
      throw new ConvexError(
        `Tu peux donner au maximum ${limit.donate} cartes à cet ami par demande.`,
      );
    if (request.received + count > request.requested)
      throw new ConvexError(
        "Cette demande a déjà reçu des cartes. Vérifie la quantité restante.",
      );
    await migratePlayerCatalogue(ctx, userId);
    await migratePlayerCatalogue(ctx, request.ownerId);
    const [sender, recipient] = await Promise.all([
      ownedCard(ctx, userId, request.variantId),
      ownedCard(ctx, request.ownerId, request.variantId),
    ]);
    if (!sender || sender.copies < count)
      throw new ConvexError(
        "Tu n’as pas assez d’exemplaires en réserve pour ce don.",
      );
    if (!recipient)
      throw new ConvexError("Cette carte n’est plus disponible chez ton ami.");
    await ctx.db.patch(sender._id, { copies: sender.copies - count });
    await ctx.db.patch(recipient._id, { copies: recipient.copies + count });
    await ctx.db.patch(requestId, { received: request.received + count });
    if (donation) await ctx.db.patch(donation._id, { count: donated + count });
    else
      await ctx.db.insert("cardDonations", {
        requestId,
        senderId: userId,
        count,
      });
    const experience = count * limit.experience;
    await addRankExperience(ctx, userId, experience);
    return { sent: true, count, experience };
  },
});

function requireFriendSlot(count: number, limit: number, own: boolean) {
  if (limit === 0)
    throw new ConvexError(own
      ? `Les amis se débloquent au rang ${FRIENDS_UNLOCK_RANK}. Améliore tes cartes pour gagner de l’expérience.`
      : `Ce gardien doit atteindre le rang ${FRIENDS_UNLOCK_RANK} pour ajouter des amis.`);
  if (count >= limit)
    throw new ConvexError(own
      ? `Ta liste contient déjà ${limit} amis. Monte de rang pour obtenir plus de places.`
      : `Ce gardien a déjà ${limit} amis.`);
}
