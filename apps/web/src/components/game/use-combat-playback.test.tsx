import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DECK,
  createGame,
  playerView,
  validateDeck,
  type GameEvent,
} from "@sylve/game";
import { useCombatPlayback } from "./use-combat-playback";

afterEach(() => vi.useRealTimers());

describe("animations des créatures répétées", () => {
  it("wounds and removes only the targeted copy during playback", () => {
    vi.useFakeTimers();
    const state = createGame(
      [
        { userId: "alice", name: "Alice", cards: validateDeck(DEFAULT_DECK) },
        { userId: "bob", name: "Bob", cards: validateDeck(DEFAULT_DECK) },
      ],
      0,
      () => 0.25,
    );
    state.players[1]!.board = [
      { cardId: "guardian:common", row: 0, depth: 0, hp: 2 },
      { cardId: "guardian:common", row: 1, depth: 0, hp: 9 },
    ];
    const initial = {
      ...playerView(state, "alice"),
      events: [] as GameEvent[],
    };
    const latest = structuredClone(initial);
    latest.sequence = 2;
    latest.players[1]!.board = latest.players[1]!.board.slice(1);
    latest.events = [
      {
        seq: 1,
        type: "attack",
        player: 0,
        cardId: "guardian:common",
        row: 0,
        depth: 0,
        targetPlayer: 1,
        targetCardId: "guardian:common",
        targetRow: 0,
        targetDepth: 0,
        damage: 2,
        hp: 0,
      },
      {
        seq: 2,
        type: "death",
        player: 1,
        cardId: "guardian:common",
        row: 0,
        depth: 0,
      },
    ];
    const { result, rerender } = renderHook(
      ({ view }) => useCombatPlayback(view),
      { initialProps: { view: initial } },
    );
    rerender({ view: latest });
    act(() => vi.advanceTimersByTime(420));
    expect(
      result.current.display!.players[1]!.board.map((unit) => unit.hp),
    ).toEqual([0, 9]);
    act(() => vi.advanceTimersByTime(220));
    expect(result.current.display!.players[1]!.board).toEqual(
      latest.players[1]!.board,
    );
    expect(result.current.display!.players[1]!.board[0]!.row).toBe(1);
  });
});
