import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { requirePlayer } from "./lib/game_service";
import { playerLeague, playerWallet } from "./lib/progression";
import {
  FRIEND_HELP_TOKENS,
  FRIEND_LIMIT,
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
    const [accepted, pending, help, wallet] = await Promise.all([
      playerFriendships(ctx, userId, "accepted"),
      playerFriendships(ctx, userId, "pending"),
      ctx.db
        .query("friendHelp")
        .withIndex("by_sender_day_recipient", (q) =>
          q.eq("senderId", userId).eq("day", day),
        )
        .collect(),
      playerWallet(ctx, userId),
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
      limit: FRIEND_LIMIT,
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
    const [own, other, pending] = await Promise.all([
      playerFriendships(ctx, userId, "accepted"),
      playerFriendships(ctx, playerId, "accepted"),
      playerFriendships(ctx, userId, "pending"),
    ]);
    if (own.length >= FRIEND_LIMIT)
      throw new ConvexError("Ta liste contient déjà 25 amis.");
    if (other.length >= FRIEND_LIMIT)
      throw new ConvexError("Ce gardien a déjà 25 amis.");
    if (
      pending.filter((item) => item.requestedBy === userId).length >=
      FRIEND_LIMIT
    )
      throw new ConvexError("Tu as déjà 25 demandes en attente.");
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
    const [own, other] = await Promise.all([
      playerFriendships(ctx, userId, "accepted"),
      playerFriendships(ctx, playerId, "accepted"),
    ]);
    // Both indexed reads participate in the transaction: concurrent acceptances
    // cannot exceed the cap on either player's list.
    if (own.length >= FRIEND_LIMIT)
      throw new ConvexError("Ta liste contient déjà 25 amis.");
    if (other.length >= FRIEND_LIMIT)
      throw new ConvexError("Ce gardien a déjà 25 amis.");
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
    if (previous) return { sent: false, tokens: FRIEND_HELP_TOKENS };
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
    return { sent: true, tokens: FRIEND_HELP_TOKENS };
  },
});
