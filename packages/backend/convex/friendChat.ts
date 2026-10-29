import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlayer } from "./lib/game_service";
import { friendship, friendshipPair, requireFriend, socialProfiles } from "./lib/social";
import {
  WORLD_CHAT_HISTORY_LIMIT,
  WORLD_CHAT_MESSAGE_LIMIT,
  WORLD_CHAT_SEND_INTERVAL_MS,
} from "./lib/chat";
import { authComponent } from "./auth";

export const list = query({
  args: { playerId: v.string() },
  handler: async (ctx, { playerId }) => {
    const { userId, name } = await requirePlayer(ctx);
    // Revocation returns an empty conversation to a live subscriber immediately.
    const relation = await friendship(ctx, userId, playerId);
    if (relation?.status !== "accepted") return [];
    const other = await authComponent.getAnyUserById(ctx, playerId);
    const { playerA, playerB } = friendshipPair(userId, playerId);
    const messages = await ctx.db
      .query("friendMessages")
      .withIndex("by_pair", (q) =>
        q.eq("playerA", playerA).eq("playerB", playerB),
      )
      .order("desc")
      .take(WORLD_CHAT_HISTORY_LIMIT);
    const profiles = await socialProfiles(ctx, messages.map((message) => message.senderId));
    return messages.reverse().map((message, index, history) => ({
      id: message._id,
      playerId: message.senderId,
      profile: profiles.get(message.senderId)!.profile,
      trophies: profiles.get(message.senderId)!.trophies,
      senderName:
        message.senderId === userId ? name : (other?.name ?? "Gardien"),
      sentAt: message._creationTime,
      body: message.body,
      isOwn: message.senderId === userId,
      continuesPrevious:
        index > 0 && history[index - 1]!.senderId === message.senderId,
    }));
  },
});

export const send = mutation({
  args: { playerId: v.string(), body: v.string() },
  handler: async (ctx, { playerId, body }) => {
    const { userId } = await requirePlayer(ctx);
    await requireFriend(ctx, userId, playerId);
    body = body.trim();
    if (!body) throw new ConvexError("Écris un message avant de l’envoyer.");
    if (body.length > WORLD_CHAT_MESSAGE_LIMIT)
      throw new ConvexError(
        `Ton message ne peut pas dépasser ${WORLD_CHAT_MESSAGE_LIMIT} caractères.`,
      );
    const previous = await ctx.db
      .query("friendMessages")
      .withIndex("by_sender", (q) => q.eq("senderId", userId))
      .order("desc")
      .first();
    if (
      previous &&
      Date.now() - previous._creationTime < WORLD_CHAT_SEND_INTERVAL_MS
    )
      throw new ConvexError("Patiente deux secondes entre deux messages.");
    return ctx.db.insert("friendMessages", {
      ...friendshipPair(userId, playerId),
      senderId: userId,
      body,
    });
  },
});
