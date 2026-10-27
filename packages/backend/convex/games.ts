import { heroAbilityIdValidator } from "./lib/validators";
import {
  endTurn as resolveTurn,
  playerView,
  summon,
  withdraw,
  surrender as concede,
  createGame,
  useHeroAbility,
} from "@sylve/game";
import {
  chooseComputerMove,
  chooseComputerHeroAbility,
  computerDeckForLeague,
  PRACTICE_COMPUTER_ID,
  PRACTICE_DEADLINE,
} from "@sylve/game/practice";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
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
import { playerLeague } from "./lib/progression";
import { readHeroProgress } from "./lib/heroes";

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
    const hero = await readHeroProgress(ctx, user.userId, cards);
    const gameId = await ctx.db.insert("games", {
      mode: "private",
      hostId: user.userId,
      hostName: user.name,
      hostCards: cards,
      hostHeroLevel: hero.level,
      hostHeroId: hero.heroId,
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
    return {
      ...view,
      mode: game.mode ?? "private",
      reward: game.reward?.ownerId === user.userId ? game.reward : null,
      trophyChange:
        game.trophyChanges?.find((change) => change.ownerId === user.userId) ??
        null,
      events: events.reverse().map((entry) => entry.event),
    };
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
        Math.random,
      ),
    );
    await saveTransition(ctx, args.gameId, transition);
  },
});
export const playHeroAbility = mutation({
  args: {
    gameId: v.id("games"),
    abilityId: heroAbilityIdValidator,
    expectedUses: v.number(),
    expectedTurn: v.number(),
  },
  handler: async (ctx, { gameId, abilityId, expectedUses, expectedTurn }) => {
    const user = await requirePlayer(ctx);
    const { state, player } = await requireMatch(ctx, gameId, user.userId);
    await saveTransition(
      ctx,
      gameId,
      rules(() =>
        useHeroAbility(
          state,
          player,
          abilityId,
          expectedUses,
          expectedTurn,
          Date.now(),
          Math.random,
        ),
      ),
    );
  },
});
export const withdrawCard = mutation({
  args: {
    gameId: v.id("games"),
    cardId: v.string(),
    expectedTurn: v.number(),
    position: v.optional(v.object({ row: v.number(), depth: v.number() })),
  },
  handler: async (ctx, { gameId, cardId, expectedTurn, position }) => {
    const user = await requirePlayer(ctx);
    const { state, player } = await requireMatch(ctx, gameId, user.userId);
    await saveTransition(
      ctx,
      gameId,
      rules(() =>
        withdraw(state, player, cardId, expectedTurn, Date.now(), position),
      ),
    );
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
      game.mode === "solo" ||
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
  },
});

export const createSolo = mutation({
  args: { deckId: v.id("decks") },
  handler: async (ctx, { deckId }) => {
    const user = await requirePlayer(ctx);
    await requireIdle(ctx, user.userId);
    const cards = await deckSnapshot(ctx, deckId, user.userId);
    const league = await playerLeague(ctx, user.userId);
    const computerCards = computerDeckForLeague(
      league.trophies,
      cards,
      Math.random,
    );
    const hero = await readHeroProgress(ctx, user.userId, cards);
    const state = createGame(
      [
        {
          ...user,
          cards,
          heroLevel: hero.level,
          heroId: hero.heroId,
        },
        {
          userId: PRACTICE_COMPUTER_ID,
          name: "Gardien mécanique",
          cards: computerCards,
        },
      ],
      Date.now(),
      Math.random,
    );
    state.activePlayer = 0;
    state.turnEndsAt = PRACTICE_DEADLINE;
    const gameId = await ctx.db.insert("games", {
      mode: "solo",
      status: "active",
      hostId: user.userId,
      hostName: user.name,
      hostCards: cards,
      guestId: PRACTICE_COMPUTER_ID,
      state,
    });
    await setActivity(ctx, user.userId, { gameId });
    return gameId;
  },
});

async function runSoloTurn(
  ctx: MutationCtx,
  gameId: Id<"games">,
  expectedTurn: number,
  expectedSequence?: number,
) {
  const game = await ctx.db.get(gameId);
  const state = game?.state;
  if (
    game?.mode !== "solo" ||
    game.status !== "active" ||
    !state ||
    state.turn !== expectedTurn ||
    state.activePlayer !== 1 ||
    (expectedSequence !== undefined && state.sequence !== expectedSequence)
  )
    return;
  const ability = chooseComputerHeroAbility(
    playerView(state, PRACTICE_COMPUTER_ID),
  );
  if (ability) {
    await saveTransition(
      ctx,
      gameId,
      useHeroAbility(
        state,
        1,
        ability.id,
        state.players[1]!.heroAbilityUses ?? 0,
        expectedTurn,
        Date.now(),
        Math.random,
      ),
    );
    return;
  }
  const move = chooseComputerMove(
    playerView(state, PRACTICE_COMPUTER_ID),
    Math.random,
    game.soloRecentCards ?? [],
  );
  const transition = move
    ? summon(
        state,
        1,
        move.cardId,
        move.row,
        move.depth,
        expectedTurn,
        Date.now(),
        Math.random,
      )
    : resolveTurn(state, 1, expectedTurn, Date.now(), Math.random);
  await saveTransition(ctx, gameId, transition);
}

export const soloTurn = mutation({
  args: {
    gameId: v.id("games"),
    expectedTurn: v.number(),
    expectedSequence: v.optional(v.number()),
  },
  handler: async (ctx, { gameId, expectedTurn, expectedSequence }) => {
    const user = await requirePlayer(ctx);
    const game = await ctx.db.get(gameId);
    if (!game || game.mode !== "solo" || game.hostId !== user.userId)
      throw new ConvexError("Ce combat solo ne t’appartient pas.");
    await runSoloTurn(ctx, gameId, expectedTurn, expectedSequence);
  },
});
export const soloTurnFallback = internalMutation({
  args: {
    gameId: v.id("games"),
    expectedTurn: v.number(),
    expectedSequence: v.optional(v.number()),
  },
  handler: async (ctx, { gameId, expectedTurn, expectedSequence }) => {
    await runSoloTurn(ctx, gameId, expectedTurn, expectedSequence);
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
