import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlayer } from "./lib/game_service";
import {
  WORLD_CHAT_HISTORY_LIMIT,
  WORLD_CHAT_MESSAGE_LIMIT,
  WORLD_CHAT_SEND_INTERVAL_MS,
} from "./lib/chat";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requirePlayer(ctx);
    const messages = await ctx.db
      .query("worldMessages")
      .order("desc")
      .take(WORLD_CHAT_HISTORY_LIMIT);

    return messages.reverse().map((message, index, history) => ({
      id: message._id,
      sentAt: message._creationTime,
      senderName: message.senderName,
      playerId: message.senderId,
      body: message.body,
      isOwn: message.senderId === userId,
      continuesPrevious:
        index > 0 && history[index - 1]!.senderId === message.senderId,
    }));
  },
});

export const send = mutation({
  args: { body: v.string() },
  handler: async (ctx, { body }) => {
    const { userId, name } = await requirePlayer(ctx);
    body = body.trim();
    if (!body) throw new ConvexError("Écris un message avant de l’envoyer.");
    if (body.length > WORLD_CHAT_MESSAGE_LIMIT)
      throw new ConvexError(
        `Ton message ne peut pas dépasser ${WORLD_CHAT_MESSAGE_LIMIT} caractères.`,
      );

    // The indexed read and insert share a transaction, including concurrent sends.
    const previous = await ctx.db
      .query("worldMessages")
      .withIndex("by_sender", (q) => q.eq("senderId", userId))
      .order("desc")
      .first();
    if (
      previous &&
      Date.now() - previous._creationTime < WORLD_CHAT_SEND_INTERVAL_MS
    )
      throw new ConvexError("Patiente deux secondes entre deux messages.");

    return await ctx.db.insert("worldMessages", {
      senderId: userId,
      senderName: name.trim().slice(0, 60) || "Gardien",
      body,
    });
  },
});
