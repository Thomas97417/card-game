import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DECK,
  createGame,
  playerView,
  summon,
  validateDeck,
  type GameEvent,
} from "@sylve/game";
import { useCombatPlayback } from "./use-combat-playback";
import { COMBAT_TIMING } from "./combat-timing";

afterEach(() => vi.useRealTimers());

function summonViews() {
  const state = createGame(
    [
      { userId: "alice", name: "Alice", cards: validateDeck(DEFAULT_DECK) },
      { userId: "bob", name: "Bob", cards: validateDeck(DEFAULT_DECK) },
    ],
    0,
    () => 0.25,
  );
  const card = state.players[0]!.cards[0]!;
  const initial = { ...playerView(state, "alice"), events: [] as GameEvent[] };
  const transition = summon(state, 0, card.id, 0, 0, state.turn, 1, () => 0.25);
  const confirmed = {
    ...playerView(transition.state, "alice"),
    events: transition.events,
  };
  const preview = {
    ...initial,
    hasSummoned: true,
    players: initial.players.map((player, index) =>
      index === 0 ? { ...player, board: confirmed.players[0]!.board } : player,
    ),
  };
  return { initial, confirmed, preview, card };
}

describe("réactivité du placement", () => {
  it("renders a summon at the start of its animation and keeps damage at impact", () => {
    vi.useFakeTimers();
    const { initial, confirmed, card } = summonViews();
    const { result, rerender } = renderHook(
      ({ view }) => useCombatPlayback(view),
      {
        initialProps: { view: initial },
      },
    );
    rerender({ view: confirmed });
    act(() => vi.advanceTimersByTime(0));
    expect(result.current.display!.players[0]!.board).toEqual(
      confirmed.players[0]!.board,
    );
    expect(result.current.event?.type).toBe("summon");
    act(() =>
      vi.advanceTimersByTime(COMBAT_TIMING.summon + COMBAT_TIMING.impact - 1),
    );
    expect(result.current.display!.players[1]!.heroHp).toBe(
      initial.players[1]!.heroHp,
    );
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.display!.players[1]!.heroHp).toBe(
      initial.players[1]!.heroHp - card.attack,
    );
  });

  it("keeps the local creature visible during a slow request and reconciles it without duplicates", () => {
    vi.useFakeTimers();
    const { initial, confirmed, preview } = summonViews();
    const { result, rerender } = renderHook(
      ({ view }) => useCombatPlayback(view),
      {
        initialProps: { view: initial },
      },
    );
    rerender({ view: preview });
    expect(result.current.display!.players[0]!.board).toHaveLength(1);
    act(() => vi.advanceTimersByTime(2500));
    expect(result.current.display!.players[0]!.board).toHaveLength(1);
    expect(result.current.display!.players[1]!.heroHp).toBe(
      initial.players[1]!.heroHp,
    );
    expect(result.current.event).toBeNull();
    rerender({ view: confirmed });
    expect(result.current.display!.players[0]!.board).toHaveLength(1);
    act(() => vi.advanceTimersByTime(0));
    expect(result.current.display!.players[0]!.board).toHaveLength(1);
    act(() => vi.runAllTimers());
    expect(result.current.display).toEqual(confirmed);
    expect(result.current.playing).toBe(false);
  });

  it("removes a rejected preview and restores the unchanged hand and board", () => {
    vi.useFakeTimers();
    const { initial, preview } = summonViews();
    const { result, rerender } = renderHook(
      ({ view }) => useCombatPlayback(view),
      {
        initialProps: { view: initial },
      },
    );
    rerender({ view: preview });
    expect(result.current.display!.players[0]!.board).toHaveLength(1);
    rerender({ view: initial });
    act(() => vi.runAllTimers());
    expect(result.current.display).toEqual(initial);
    expect(result.current.display!.hasSummoned).toBe(false);
    expect(result.current.playing).toBe(false);
  });
});

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
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.impact - 1));
    expect(result.current.display!.players[1]!.board[0]!.hp).toBe(2);
    act(() => vi.advanceTimersByTime(1));
    expect(
      result.current.display!.players[1]!.board.map((unit) => unit.hp),
    ).toEqual([0, 9]);
    expect(result.current.event?.type).toBe("attack");
    act(() =>
      vi.advanceTimersByTime(COMBAT_TIMING.attack - COMBAT_TIMING.impact),
    );
    expect(result.current.event?.type).toBe("death");
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.death));
    expect(result.current.display!.players[1]!.board).toEqual(
      latest.players[1]!.board,
    );
    expect(result.current.display!.players[1]!.board[0]!.row).toBe(1);
    expect(result.current.playing).toBe(true);
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.damage));
    expect(result.current.playing).toBe(false);
  });
});
