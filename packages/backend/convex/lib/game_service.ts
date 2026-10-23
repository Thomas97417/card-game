import { ConvexError } from "convex/values";
import {
  createGame,
  DECK_SIZE,
  GameError,
  validateDeck,
  type Transition,
} from "@sylve/game";
import { authComponent } from "../auth";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { PRACTICE_DEADLINE } from "@sylve/game/practice";
import { awardVictoryChest, ownedDeck, playerLeague } from "./progression";

export async function requirePlayer(ctx: QueryCtx | MutationCtx) {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new ConvexError("Connecte-toi pour jouer.");
  return { userId: String(user._id), name: user.name };
}
/** Keep legacy decks intact; the most recently edited one is the single active deck. */
export async function currentDeck(ctx: QueryCtx | MutationCtx, userId: string) {
  const decks = await ctx.db
    .query("decks")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .collect();
  const deck = decks.sort(
    (a, b) => b.updatedAt - a.updatedAt || b._creationTime - a._creationTime,
  )[0];
  if (!deck) return null;
  const league = await playerLeague(ctx, userId);
  // Preserve legacy records and owned cards; only unlocked slots enter a match.
  return { ...deck, cardIds: deck.cardIds.slice(0, league.deckCapacity) };
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
  const deck = await currentDeck(ctx, userId);
  if (!deck || deck._id !== deckId)
    throw new ConvexError("Ce deck ne t’appartient pas.");
  rules(() => validateDeck(deck.cardIds));
  return ownedDeck(ctx, userId, deck.cardIds);
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
      {
        userId: game.hostId,
        name: game.hostName,
        cards:
          game.hostCards.length === 10
            ? game.hostCards.slice(0, DECK_SIZE)
            : game.hostCards,
      },
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
  const game = await ctx.db.get(gameId);
  if (!game || game.status === "finished") return;
  if (game.mode === "solo") state.turnEndsAt = PRACTICE_DEADLINE;
  await ctx.db.patch(gameId, { state, status: state.status });
  for (const event of events)
    await ctx.db.insert("gameEvents", { gameId, seq: event.seq, event });
  if (
    state.status === "active" &&
    events.some((event) => event.type === "turn")
  ) {
    if (game.mode === "solo") {
      if (state.activePlayer === 1)
        // A full board can take twenty seconds to animate before the client
        // asks the computer to act. Keep the recovery path behind playback.
        await ctx.scheduler.runAfter(30_000, internal.games.soloTurnFallback, {
          gameId,
          expectedTurn: state.turn,
        });
    } else
      await ctx.scheduler.runAt(state.turnEndsAt, internal.games.expireTurn, {
        gameId,
        expectedTurn: state.turn,
      });
  }
  if (state.status === "finished") {
    await awardVictoryChest(ctx, game, state);
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
