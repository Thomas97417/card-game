import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { requirePlayer } from "./lib/game_service";
import { playerLeague, playerWallet } from "./lib/progression";
import { FRIEND_HELP_EXPERIENCE, FRIENDS_UNLOCK_RANK } from "@sylve/game/ranks";
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
