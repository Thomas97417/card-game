import {
  endTurn as resolveTurn,
  playerView,
  summon,
  surrender as concede,
} from "@sylve/game";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  deckSnapshot,
  getActivity,
  requireIdle,
  requireMatch,
  requirePlayer,
  rules,
  saveTransition,
  setActivity,
  startMatch,
} from "./lib/game_service";

export const activity = query({
  args: {},
  handler: async (ctx) => {
    const user = await requirePlayer(ctx);
    const current = await getActivity(ctx, user.userId);
    const game = current?.gameId ? await ctx.db.get(current.gameId) : null;
    const entry = current?.queueId ? await ctx.db.get(current.queueId) : null;
    return {
      gameId:
        game && (game.status === "active" || game.status === "waiting")
          ? game._id
          : null,
      status: game?.status ?? null,
      inviteCode: game?.status === "waiting" ? (game.inviteCode ?? null) : null,
      queued: !!entry && entry.expiresAt > Date.now(),
    };
  },
});
export const invitation = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    await requirePlayer(ctx);
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("inviteCode", code.toUpperCase()))
      .unique();
    if (
      !game ||
      game.status !== "waiting" ||
      (game.waitingExpiresAt ?? 0) <= Date.now()
    )
      return null;
    return { hostName: game.hostName };
  },
});
export const createPrivate = mutation({
  args: { deckId: v.id("decks") },
  handler: async (ctx, { deckId }) => {
    const user = await requirePlayer(ctx);
    await requireIdle(ctx, user.userId);
    const cards = await deckSnapshot(ctx, deckId, user.userId);
    let code: string;
    do {
      code = Array.from(
        { length: 8 },
        () =>
          "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)],
      ).join("");
    } while (
      await ctx.db
        .query("games")
        .withIndex("by_code", (q) => q.eq("inviteCode", code))
        .first()
    );
    const expiresAt = Date.now() + 10 * 60_000;
    const gameId = await ctx.db.insert("games", {
      hostId: user.userId,
      hostName: user.name,
      hostCards: cards,
      status: "waiting",
      inviteCode: code,
      waitingExpiresAt: expiresAt,
    });
    await setActivity(ctx, user.userId, { gameId });
    await ctx.scheduler.runAt(expiresAt, internal.games.expireInvitation, {
      gameId,
    });
    return { gameId, code };
  },
});
export const joinPrivate = mutation({
  args: { code: v.string(), deckId: v.id("decks") },
  handler: async (ctx, { code, deckId }) => {
    const user = await requirePlayer(ctx);
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) =>
        q.eq("inviteCode", code.trim().toUpperCase()),
      )
      .unique();
    if (
      !game ||
      game.status !== "waiting" ||
      (game.waitingExpiresAt ?? 0) <= Date.now()
    )
      throw new ConvexError("Cette invitation est invalide ou a expiré.");
    if (game.hostId === user.userId)
      throw new ConvexError("Partage ce code avec un autre joueur.");
    await requireIdle(ctx, user.userId);
    const cards = await deckSnapshot(ctx, deckId, user.userId);
    await startMatch(ctx, game._id, user, cards);
    return game._id;
  },
});
export const cancelPrivate = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const user = await requirePlayer(ctx);
    const game = await ctx.db.get(gameId);
    if (!game || game.hostId !== user.userId)
      throw new ConvexError("Cette invitation ne t’appartient pas.");
    if (game.status !== "waiting")
      throw new ConvexError("La partie a déjà commencé.");
    await ctx.db.patch(gameId, { status: "cancelled" });
    const current = await getActivity(ctx, user.userId);
    if (current?.gameId === gameId) await setActivity(ctx, user.userId, {});
  },
});
export const get = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const user = await requirePlayer(ctx);
    const game = await ctx.db.get(gameId);
    if (!game?.state)
      throw new ConvexError("Partie introuvable ou pas encore commencée.");
    const view = rules(() => playerView(game.state!, user.userId));
    const events = await ctx.db
      .query("gameEvents")
      .withIndex("by_game_seq", (q) => q.eq("gameId", gameId))
      .order("desc")
      .take(80);
    return { ...view, events: events.reverse().map((entry) => entry.event) };
  },
});
export const playCard = mutation({
  args: {
    gameId: v.id("games"),
    cardId: v.string(),
    row: v.number(),
    depth: v.number(),
    expectedTurn: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requirePlayer(ctx);
    const { state, player } = await requireMatch(ctx, args.gameId, user.userId);
    const transition = rules(() =>
      summon(
        state,
        player,
        args.cardId,
        args.row,
        args.depth,
        args.expectedTurn,
        Date.now(),
      ),
    );
    await saveTransition(ctx, args.gameId, transition);
  },
});
export const endTurn = mutation({
  args: { gameId: v.id("games"), expectedTurn: v.number() },
  handler: async (ctx, { gameId, expectedTurn }) => {
    const user = await requirePlayer(ctx);
    const { state, player } = await requireMatch(ctx, gameId, user.userId);
    const transition = rules(() =>
      resolveTurn(state, player, expectedTurn, Date.now(), Math.random),
    );
    await saveTransition(ctx, gameId, transition);
    if (transition.state.status === "active")
      await ctx.scheduler.runAt(
        transition.state.turnEndsAt,
        internal.games.expireTurn,
        { gameId, expectedTurn: transition.state.turn },
      );
  },
});
export const surrender = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const user = await requirePlayer(ctx);
    const { state, player } = await requireMatch(ctx, gameId, user.userId);
    await saveTransition(
      ctx,
      gameId,
      rules(() => concede(state, player)),
    );
  },
});
export const expireTurn = internalMutation({
  args: { gameId: v.id("games"), expectedTurn: v.number() },
  handler: async (ctx, { gameId, expectedTurn }): Promise<void> => {
    const game = await ctx.db.get(gameId);
    if (
      !game?.state ||
      game.status !== "active" ||
      game.state.turn !== expectedTurn ||
      Date.now() < game.state.turnEndsAt
    )
      return;
    const transition = resolveTurn(
      game.state,
      game.state.activePlayer,
      expectedTurn,
      Date.now(),
      Math.random,
    );
    await saveTransition(ctx, gameId, transition);
    if (transition.state.status === "active")
      await ctx.scheduler.runAt(
        transition.state.turnEndsAt,
        internal.games.expireTurn,
        { gameId, expectedTurn: transition.state.turn },
      );
  },
});
export const expireInvitation = internalMutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const game = await ctx.db.get(gameId);
    if (
      !game ||
      game.status !== "waiting" ||
      (game.waitingExpiresAt ?? 0) > Date.now()
    )
      return;
    await ctx.db.patch(gameId, { status: "cancelled" });
    const current = await getActivity(ctx, game.hostId);
    if (current?.gameId === gameId) await setActivity(ctx, game.hostId, {});
  },
});
