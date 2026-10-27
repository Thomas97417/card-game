import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DECK,
  createGame,
  playerView,
  summon,
  endTurn,
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
    { field: false },
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
  it("renders an already loaded duel on its first render without a loading frame", () => {
    const { initial } = summonViews();
    const frames: unknown[] = [];
    renderHook(() => {
      const playback = useCombatPlayback(initial);
      frames.push(playback.display);
    });
    expect(frames[0]).toBe(initial);
  });

  it("keeps a pentagram visible and applies its bonus at the start-of-turn ability impact", () => {
    vi.useFakeTimers();
    const state = createGame(
      [
        { userId: "alice", name: "Alice", cards: validateDeck(DEFAULT_DECK) },
        { userId: "bob", name: "Bob", cards: validateDeck(DEFAULT_DECK) },
      ],
      0,
      () => 0.25,
      { field: false },
    );
    const owner = state.players[0]!;
    owner.pentagrams = [{ row: 0, depth: 0, attack: 2 }];
    const card = owner.cards[0]!;
    owner.board = [{ cardId: card.id, row: 0, depth: 0, hp: card.health }];
    state.activePlayer = 1;
    const initial = {
      ...playerView(state, "alice"),
      events: [] as GameEvent[],
    };
    const transition = endTurn(state, 1, 1, 1, () => 0.25);
    const confirmed = {
      ...playerView(transition.state, "alice"),
      events: transition.events,
    };
    const { result, rerender } = renderHook(
      ({ view }) => useCombatPlayback(view),
      { initialProps: { view: initial } },
    );
    rerender({ view: confirmed });
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.abilityImpact - 1));
    expect(result.current.display!.players[0]!.pentagrams).toHaveLength(1);
    expect(result.current.display!.players[0]!.board[0]!.card.attack).toBe(
      card.attack,
    );
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.display!.players[0]!.pentagrams).toHaveLength(1);
    expect(result.current.display!.players[0]!.board[0]!.card.attack).toBe(
      card.attack + 2,
    );
    expect(result.current.display!.players[1]!.heroHp).toBe(
      initial.players[1]!.heroHp,
    );
    act(() => vi.runAllTimers());
    expect(result.current.display).toEqual(confirmed);
  });
  it.each(["rune", "pentagram"] as const)(
    "removes a dead unit's %s at the death animation commit",
    (kind) => {
      vi.useFakeTimers();
      const state = createGame(
        [
          { userId: "alice", name: "Alice", cards: validateDeck(DEFAULT_DECK) },
          { userId: "bob", name: "Bob", cards: validateDeck(DEFAULT_DECK) },
        ],
        0,
        () => 0.25,
        { field: false },
      );
      const owner = state.players[0]!;
      const card = owner.cards[0]!;
      owner.board = [{ cardId: card.id, row: 0, depth: 0, hp: 1 }];
      const mark = { row: 0, depth: 0, attack: 2 };
      if (kind === "rune") owner.runes = [{ ...mark, activated: true }];
      else owner.pentagrams = [mark];
      state.players[1]!.board = [
        { cardId: card.id, row: 0, depth: 0, hp: card.health, attack: 20 },
      ];
      state.activePlayer = 1;
      const initial = {
        ...playerView(state, "alice"),
        events: [] as GameEvent[],
      };
      const transition = endTurn(state, 1, 1, 1, () => 0.25);
      const confirmed = {
        ...playerView(transition.state, "alice"),
        events: transition.events,
      };
      const { result, rerender } = renderHook(
        ({ view }) => useCombatPlayback(view),
        { initialProps: { view: initial } },
      );
      rerender({ view: confirmed });
      const key = kind === "rune" ? "runes" : "pentagrams";
      act(() =>
        vi.advanceTimersByTime(COMBAT_TIMING.attack + COMBAT_TIMING.death - 1),
      );
      expect(result.current.display!.players[0]![key]).toHaveLength(1);
      act(() => vi.advanceTimersByTime(1));
      expect(result.current.display!.players[0]![key]).toEqual([]);
      expect(result.current.display!.players[0]!.board).toEqual([]);
    },
  );
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
  it("commits all targets together while preserving an interleaved reaction's snapshots", () => {
    vi.useFakeTimers();
    const cards = validateDeck(DEFAULT_DECK);
    const state = createGame([
      { userId: "alice", name: "Alice", cards },
      { userId: "bob", name: "Bob", cards },
    ], 0, () => 0.25, { field: false });
    state.activePlayer = 0;
    const caster = state.players[0]!.cards.find((card) => card.id === "wisp:common")!;
    caster.abilities = [{
      id: "rally", name: "Ralliement", description: "Accorde de l’attaque.",
      unlockLevel: 1, active: true, effect: "attack", trigger: "deploy", target: "all_allies", value: 2,
    }];
    state.players[0]!.board = [0, 1].map((row) => ({
      cardId: DEFAULT_DECK[0]!, row, depth: 0, hp: 10, attackCurse: 1,
    }));
    const initial = { ...playerView(state, "alice"), events: [] as GameEvent[] };
    const transition = summon(state, 0, caster.id, 3, 2, 1, 1, () => 0.25);
    const confirmed = { ...playerView(transition.state, "alice"), events: transition.events };
    const { result, rerender } = renderHook(({ view }) => useCombatPlayback(view), {
      initialProps: { view: initial },
    });
    rerender({ view: confirmed });
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.summon));
    expect(result.current.events.map((event) => event.ability)).toEqual([
      "Ralliement", "Malédiction", "Ralliement",
    ]);
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.abilityImpact - 1));
    expect(result.current.display!.players[0]!.board.slice(0, 2).map((unit) => unit.card.attack)).toEqual([3, 3]);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.display!.players[0]!.board.slice(0, 2).map((unit) => unit.card.attack)).toEqual([5, 5]);
    expect(result.current.display!.players[0]!.board.slice(0, 2).map((unit) => unit.hp)).toEqual([9, 10]);
    act(() => vi.runAllTimers());
    expect(result.current.display).toEqual(confirmed);
    expect(result.current.events).toEqual([]);
  });

  it("animates a summoned token from its event without inserting it into the deck", () => {
    vi.useFakeTimers();
    const cards = validateDeck([
      "captain:common",
      "guardian:common",
      "turtle:common",
      "wisp:common",
    ]);
    const state = createGame(
      [
        { userId: "alice", name: "Alice", cards },
        { userId: "bob", name: "Bob", cards: validateDeck(DEFAULT_DECK) },
      ],
      0,
      () => 0.25,
      { field: false },
    );
    const initial = {
      ...playerView(state, "alice"),
      events: [] as GameEvent[],
    };
    const transition = summon(
      state,
      0,
      "captain:common",
      0,
      0,
      1,
      1,
      () => 0.25,
    );
    const confirmed = {
      ...playerView(transition.state, "alice"),
      events: transition.events,
    };
    const { result, rerender } = renderHook(
      ({ view }) => useCombatPlayback(view),
      { initialProps: { view: initial } },
    );
    rerender({ view: confirmed });
    act(() => vi.advanceTimersByTime(0));
    expect(result.current.display!.players[0]!.board).toHaveLength(1);
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.summon));
    expect(result.current.event?.ability).toBe("Renfort");
    expect(result.current.display!.players[0]!.board[1]).toMatchObject({
      card: { name: "Éclaireur des braises", attack: 5, health: 4 },
      row: 0,
      depth: 1,
    });
    expect(result.current.display!.players[0]!.deck).toHaveLength(4);
    act(() => vi.runAllTimers());
    expect(result.current.display).toEqual(confirmed);
  });

  it("commits a health buff and its new maximum at the ability impact", () => {
    vi.useFakeTimers();
    const cards = validateDeck([
      "mushroom:common",
      "guardian:common",
      "turtle:common",
      "wisp:common",
    ]);
    const state = createGame(
      [
        { userId: "alice", name: "Alice", cards },
        { userId: "bob", name: "Bob", cards: validateDeck(DEFAULT_DECK) },
      ],
      0,
      () => 0.25,
      { field: false },
    );
    state.players[0]!.board = [
      { cardId: "guardian:common", row: 0, depth: 0, hp: 8 },
    ];
    const initial = {
      ...playerView(state, "alice"),
      events: [] as GameEvent[],
    };
    const transition = summon(
      state,
      0,
      "mushroom:common",
      1,
      2,
      1,
      1,
      () => 0.25,
    );
    const confirmed = {
      ...playerView(transition.state, "alice"),
      events: transition.events,
    };
    const { result, rerender } = renderHook(
      ({ view }) => useCombatPlayback(view),
      { initialProps: { view: initial } },
    );
    rerender({ view: confirmed });
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.summon + 179));
    expect(result.current.display!.players[0]!.board[0]).toMatchObject({
      hp: 8,
      card: { health: 10 },
    });
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.display!.players[0]!.board[0]).toMatchObject({
      hp: 9,
      maxHp: 11,
      card: { health: 11 },
    });
    expect(initial.players[0]!.board[0]!.hp).toBe(8);
    act(() => vi.runAllTimers());
    expect(result.current.display).toEqual(confirmed);
  });

  it("wounds and removes only the targeted copy during playback", () => {
    vi.useFakeTimers();
    const state = createGame(
      [
        { userId: "alice", name: "Alice", cards: validateDeck(DEFAULT_DECK) },
        { userId: "bob", name: "Bob", cards: validateDeck(DEFAULT_DECK) },
      ],
      0,
      () => 0.25,
      { field: false },
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
