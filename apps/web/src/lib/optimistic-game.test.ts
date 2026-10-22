import { describe, expect, it, vi } from "vitest";
import type { OptimisticLocalStore } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import {
  DEFAULT_DECK,
  createGame,
  playerView,
  validateDeck,
} from "@sylve/game";
import { optimisticallyPlayCard } from "./optimistic-game";

type Game = FunctionReturnType<typeof api.games.get>;

function setup(me = 0) {
  const state = createGame(
    [
      { userId: "alice", name: "Alice", cards: validateDeck(DEFAULT_DECK) },
      { userId: "bob", name: "Bob", cards: validateDeck(DEFAULT_DECK) },
    ],
    Date.now(),
    () => 0.25,
  );
  state.activePlayer = me;
  const game: Game = {
    ...playerView(state, me === 0 ? "alice" : "bob"),
    events: [],
    mode: "solo",
    reward: null,
  };
  const card = game.players[me]!.deck[0]!;
  const args = {
    gameId: "test-game" as Id<"games">,
    cardId: card.id,
    row: 0,
    depth: 0,
    expectedTurn: game.turn,
  };
  const store: OptimisticLocalStore = {
    getQuery: vi.fn().mockReturnValue(game),
    getAllQueries: vi.fn().mockReturnValue([]),
    setQuery: vi.fn(),
  };
  const preview = () =>
    vi.mocked(store.setQuery).mock.calls.at(-1)?.[2] as Game | undefined;
  return { game, card, args, store, preview };
}

describe("placement local immédiat", () => {
  it.each([0, 1])(
    "places player %i's creature without predicting combat or draws",
    (me) => {
      const { game, card, args, store, preview } = setup(me);
      const original = structuredClone(game);
      optimisticallyPlayCard(store, args);
      const next = preview()!;
      expect(store.setQuery).toHaveBeenCalledWith(
        api.games.get,
        { gameId: args.gameId },
        next,
      );
      expect(next.players[me]!.board).toEqual([
        { cardId: card.id, card, row: 0, depth: 0, hp: card.health },
      ]);
      expect(next.hasSummoned).toBe(true);
      expect(next.sequence).toBe(game.sequence);
      expect(next.turn).toBe(game.turn);
      expect(next.activePlayer).toBe(game.activePlayer);
      expect(next.events).toBe(game.events);
      expect(next.players[me]!.hand).toBe(game.players[me]!.hand);
      expect(next.players[1 - me]).toBe(game.players[1 - me]);
      expect(game).toEqual(original);
    },
  );

  it("keeps another copy's wounds and never applies the same preview twice", () => {
    const { game, card, args, store, preview } = setup();
    const existing = { cardId: card.id, card, row: 1, depth: 0, hp: 1 };
    game.players[0]!.board.push(existing);
    optimisticallyPlayCard(store, args);
    const next = preview()!;
    expect(next.players[0]!.board).toHaveLength(2);
    expect(next.players[0]!.board[0]).toBe(existing);
    expect(next.players[0]!.board[1]!.hp).toBe(card.health);
    vi.mocked(store.getQuery).mockReturnValue(next);
    optimisticallyPlayCard(store, args);
    expect(store.setQuery).toHaveBeenCalledTimes(1);
  });

  it.each([
    "opponent",
    "stale turn",
    "summoned",
    "finished",
    "expired",
    "not in hand",
    "occupied",
    "wrong column",
    "invalid row",
    "loading",
  ] as const)("does not preview an invalid move when %s", (reason) => {
    const { game, card, args, store } = setup();
    if (reason === "opponent") game.activePlayer = 1;
    if (reason === "stale turn") args.expectedTurn--;
    if (reason === "summoned") game.hasSummoned = true;
    if (reason === "finished") game.status = "finished";
    if (reason === "expired") game.turnEndsAt = 0;
    if (reason === "not in hand") game.players[0]!.hand = [];
    if (reason === "occupied")
      game.players[0]!.board.push({
        cardId: card.id,
        card,
        row: 0,
        depth: 0,
        hp: card.health,
      });
    if (reason === "wrong column") args.depth = 2;
    if (reason === "invalid row") args.row = 4;
    if (reason === "loading")
      vi.mocked(store.getQuery).mockReturnValue(undefined);
    optimisticallyPlayCard(store, args);
    expect(store.setQuery).not.toHaveBeenCalled();
  });
});
