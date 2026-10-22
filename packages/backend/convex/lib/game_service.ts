import { ConvexError } from "convex/values";
import {
  createGame,
  GameError,
  validateDeck,
  type Transition,
} from "@sylve/game";
import { authComponent } from "../auth";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function requirePlayer(ctx: QueryCtx | MutationCtx) {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new ConvexError("Connecte-toi pour jouer.");
  return { userId: String(user._id), name: user.name };
}
export function rules<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof GameError) throw new ConvexError(error.message);
    throw error;
  }
}
export async function getActivity(ctx: QueryCtx | MutationCtx, userId: string) {
  return await ctx.db
    .query("activities")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}
export async function setActivity(
  ctx: MutationCtx,
  userId: string,
  value: { gameId?: Id<"games">; queueId?: Id<"matchmakingQueue"> },
) {
  const activity = await getActivity(ctx, userId);
  const fields = { gameId: value.gameId, queueId: value.queueId };
  if (activity) await ctx.db.patch(activity._id, fields);
  else await ctx.db.insert("activities", { userId, ...fields });
}
export async function requireIdle(ctx: MutationCtx, userId: string) {
  const activity = await getActivity(ctx, userId);
  if (activity?.gameId) {
    const game = await ctx.db.get(activity.gameId);
    if (
      game?.status === "active" ||
      (game?.status === "waiting" && (game.waitingExpiresAt ?? 0) > Date.now())
    )
      throw new ConvexError("Tu as déjà une partie en cours.");
  }
  if (activity?.queueId) {
    const entry = await ctx.db.get(activity.queueId);
    if (entry && entry.expiresAt > Date.now())
      throw new ConvexError("Tu recherches déjà un adversaire.");
    if (entry) await ctx.db.delete(entry._id);
  }
  return activity;
}
export async function deckSnapshot(
  ctx: MutationCtx,
  deckId: Id<"decks">,
  userId: string,
) {
  const deck = await ctx.db.get(deckId);
  if (!deck || deck.ownerId !== userId)
    throw new ConvexError("Ce deck ne t’appartient pas.");
  return rules(() => validateDeck(deck.cardIds));
}
export async function startMatch(
  ctx: MutationCtx,
  gameId: Id<"games">,
  guest: { userId: string; name: string },
  guestCards: ReturnType<typeof validateDeck>,
) {
  const game = await ctx.db.get(gameId);
  if (!game || game.status !== "waiting")
    throw new ConvexError("Cette invitation n’est plus disponible.");
  const state = createGame(
    [
      { userId: game.hostId, name: game.hostName, cards: game.hostCards },
      { ...guest, cards: guestCards },
    ],
    Date.now(),
    Math.random,
  );
  await ctx.db.patch(gameId, {
    state,
    status: "active",
    guestId: guest.userId,
  });
  await setActivity(ctx, game.hostId, { gameId });
  await setActivity(ctx, guest.userId, { gameId });
  await ctx.scheduler.runAt(state.turnEndsAt, internal.games.expireTurn, {
    gameId,
    expectedTurn: state.turn,
  });
}
export async function saveTransition(
  ctx: MutationCtx,
  gameId: Id<"games">,
  transition: Transition,
) {
  const { state, events } = transition;
  await ctx.db.patch(gameId, { state, status: state.status });
  for (const event of events)
    await ctx.db.insert("gameEvents", { gameId, seq: event.seq, event });
  if (state.status === "finished") {
    for (const player of state.players) {
      const activity = await getActivity(ctx, player.userId);
      if (activity?.gameId === gameId)
        await setActivity(ctx, player.userId, {});
    }
  }
}
export async function requireMatch(
  ctx: MutationCtx,
  gameId: Id<"games">,
  userId: string,
) {
  const game = await ctx.db.get(gameId);
  if (!game?.state) throw new ConvexError("Partie introuvable.");
  const player = game.state.players.findIndex(
    (entry) => entry.userId === userId,
  );
  if (player < 0) throw new ConvexError("Tu ne participes pas à cette partie.");
  return { state: game.state, player };
}
