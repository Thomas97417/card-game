import { describe, expect, it } from "vitest";
import {
  CATALOG,
  DEFAULT_DECK,
  createGame,
  endTurn,
  HERO_HP,
  playerView,
  summon,
  surrender,
  TURN_MS,
  validateDeck,
  type GameState,
} from "./index";

const random = () => 0.25;
function initial() {
  return createGame(
    [
      { userId: "alice", name: "Alice", cards: validateDeck(DEFAULT_DECK) },
      { userId: "bob", name: "Bob", cards: validateDeck(DEFAULT_DECK) },
    ],
    0,
    random,
  );
}
function unit(
  state: GameState,
  player: number,
  id: string,
  row: number,
  depth: number,
  hp?: number,
) {
  const owner = state.players[player]!;
  owner.hand = owner.hand.filter((card) => card !== id);
  owner.drawPile = owner.drawPile.filter((card) => card !== id);
  owner.board.push({
    cardId: id,
    row,
    depth,
    hp: hp ?? owner.cards.find((card) => card.id === id)!.health,
  });
}
describe("construction de deck", () => {
  it("requires exactly ten known unique cards", () => {
    expect(validateDeck(DEFAULT_DECK)).toHaveLength(10);
    expect(() => validateDeck(DEFAULT_DECK.slice(1))).toThrow("10 cartes");
    expect(() =>
      validateDeck([...DEFAULT_DECK.slice(1), DEFAULT_DECK[1]!]),
    ).toThrow("unique");
    expect(() => validateDeck([...DEFAULT_DECK.slice(1), "invented"])).toThrow(
      "n’existe pas",
    );
  });
  it("snapshots card definitions", () => {
    const deck = validateDeck(DEFAULT_DECK);
    deck[0]!.attack = 100;
    expect(CATALOG[0]!.attack).not.toBe(100);
  });
});
describe("début de partie et confidentialité", () => {
  it("starts with two 30 HP heroes, five cards and a server-selected first player", () => {
    const state = initial();
    expect(state.activePlayer).toBe(0);
    expect(state.turnEndsAt).toBe(TURN_MS);
    for (const player of state.players) {
      expect(player.heroHp).toBe(HERO_HP);
      expect(player.hand).toHaveLength(5);
      expect(player.drawPile).toHaveLength(5);
    }
  });
  it("rejects self-play and spectators", () => {
    expect(() =>
      createGame(
        [
          { userId: "a", name: "A", cards: [] },
          { userId: "a", name: "A", cards: [] },
        ],
        0,
        random,
      ),
    ).toThrow();
    expect(() => playerView(initial(), "eve")).toThrow();
  });
  it("hides opponent hands, unseen definitions, user IDs and draw order", () => {
    const view = playerView(initial(), "alice");
    expect(view.players[0]!.hand).toHaveLength(5);
    expect(view.players[1]!.hand).toEqual([]);
    expect(view.players[1]!.handCount).toBe(5);
    expect(view.players[1]).not.toHaveProperty("cards");
    expect(view.players[1]).not.toHaveProperty("drawPile");
    expect(view.players[1]).not.toHaveProperty("userId");
  });
});
describe("invocation", () => {
  it("allows one summon, on an empty own cell, without mutating input", () => {
    const state = initial();
    const id = state.players[0]!.hand[0]!;
    const result = summon(state, 0, id, 2, 1, 1, 10);
    expect(state.players[0]!.board).toEqual([]);
    expect(result.state.players[0]!.board[0]).toMatchObject({
      cardId: id,
      row: 2,
      depth: 1,
    });
    expect(result.state.players[0]!.hand).toHaveLength(4);
    expect(result.events[0]!.type).toBe("summon");
    expect(() =>
      summon(result.state, 0, result.state.players[0]!.hand[0]!, 0, 0, 1, 11),
    ).toThrow("déjà");
  });
  it("rejects wrong turns, stale requests, missing cards, occupied cells and bad coordinates", () => {
    const state = initial();
    const id = state.players[0]!.hand[0]!;
    expect(() => summon(state, 1, id, 0, 0, 1, 1)).toThrow("tour");
    expect(() => summon(state, 0, id, 0, 0, 0, 1)).toThrow("changé");
    expect(() => summon(state, 0, "not-in-hand", 0, 0, 1, 1)).toThrow("main");
    for (const [row, depth] of [
      [4, 0],
      [0, 3],
      [-1, 0],
      [0.5, 0],
      [0, -1],
    ])
      expect(() => summon(state, 0, id, row!, depth!, 1, 1)).toThrow("case");
    unit(state, 0, state.players[0]!.hand[1]!, 0, 0);
    expect(() => summon(state, 0, id, 0, 0, 1, 1)).toThrow("occupée");
  });
  it("rejects summons at the deadline", () => {
    const state = initial();
    expect(() =>
      summon(state, 0, state.players[0]!.hand[0]!, 0, 0, 1, TURN_MS),
    ).toThrow("écoulé");
  });
  it("newly summoned creatures attack at once", () => {
    const state = initial();
    const id = state.players[0]!.hand[0]!;
    const card = state.players[0]!.cards.find((c) => c.id === id)!;
    const invoked = summon(state, 0, id, 0, 2, 1, 1).state;
    expect(endTurn(invoked, 0, 1, 2, random).state.players[1]!.heroHp).toBe(
      30 - card.attack,
    );
  });
});
describe("combat", () => {
  it("targets the nearest enemy in the same row; allies do not block", () => {
    const state = initial();
    unit(state, 0, "guardian", 1, 2);
    unit(state, 0, "owl", 1, 0);
    unit(state, 1, "turtle", 1, 2);
    unit(state, 1, "mushroom", 1, 0);
    unit(state, 1, "stag", 0, 0);
    const result = endTurn(state, 0, 1, 100, random);
    expect(
      result.events.filter((e) => e.type === "attack").map((e) => e.cardId),
    ).toEqual(["owl", "guardian"]);
    expect(
      result.state.players[1]!.board.find((u) => u.cardId === "mushroom")!.hp,
    ).toBe(2);
    expect(
      result.state.players[1]!.board.find((u) => u.cardId === "turtle")!.hp,
    ).toBe(12);
    expect(result.state.players[0]!.board[0]!.hp).toBe(9);
  });
  it("removes killed targets immediately, retargets and never carries excess damage", () => {
    const state = initial();
    unit(state, 0, "dragon", 0, 0);
    unit(state, 0, "fox", 0, 1);
    unit(state, 0, "owl", 0, 2);
    unit(state, 1, "guardian", 0, 0, 1);
    unit(state, 1, "wisp", 0, 1, 2);
    const result = endTurn(state, 0, 1, 100, random);
    expect(
      result.events
        .filter((e) => e.type === "attack")
        .map((e) => e.targetCardId ?? "hero"),
    ).toEqual(["guardian", "wisp", "hero"]);
    expect(result.state.players[1]!.heroHp).toBe(26);
    expect(result.state.players[1]!.board).toEqual([]);
  });
  it("resolves rows top to bottom, stops on lethal damage and rejects future actions", () => {
    const state = initial();
    unit(state, 0, "fox", 2, 0);
    unit(state, 0, "dragon", 0, 1);
    state.players[1]!.heroHp = 1;
    const result = endTurn(state, 0, 1, 100, random);
    expect(
      result.events.filter((e) => e.type === "attack").map((e) => e.cardId),
    ).toEqual(["dragon"]);
    expect(result.state.winner).toBe(0);
    expect(result.state.players[1]!.heroHp).toBe(0);
    expect(() => endTurn(result.state, 0, 1, 200, random)).toThrow("terminée");
  });
  it("keeps wounds across turns and does not retaliate", () => {
    const state = initial();
    unit(state, 0, "guardian", 0, 0);
    unit(state, 1, "turtle", 0, 0);
    const result = endTurn(state, 0, 1, 50, random).state;
    expect(result.players[1]!.board[0]!.hp).toBe(10);
    expect(result.players[0]!.board[0]!.hp).toBe(9);
    const next = endTurn(result, 1, 2, 100, random).state;
    expect(next.players[1]!.board[0]!.hp).toBe(10);
    expect(next.players[0]!.board[0]!.hp).toBe(8);
  });
});
describe("pioche et cycle des cartes", () => {
  it("recycles only dead creatures and resets HP on reinvocation", () => {
    const state = initial();
    state.players[1]!.hand = [];
    state.players[1]!.drawPile = [];
    unit(state, 0, "dragon", 0, 0);
    unit(state, 1, "fox", 0, 0, 1);
    const next = endTurn(state, 0, 1, 10, random).state;
    expect(next.players[1]!.hand).toEqual(["fox"]);
    expect(next.players[1]!.discard).toEqual([]);
    const invoked = summon(next, 1, "fox", 2, 1, 2, 20).state;
    expect(invoked.players[1]!.board[0]!.hp).toBe(3);
  });
  it("completes, rather than replaces, the next player's hand", () => {
    const state = initial();
    state.players[1]!.hand = ["fox"];
    state.players[1]!.drawPile = ["owl", "stag", "mushroom", "dragon"];
    const next = endTurn(state, 0, 1, 1, random).state;
    expect(next.players[1]!.hand).toEqual([
      "fox",
      "owl",
      "stag",
      "mushroom",
      "dragon",
    ]);
    expect(next.turn).toBe(2);
    expect(next.hasSummoned).toBe(false);
    expect(next.turnEndsAt).toBe(TURN_MS + 1);
  });
  it("permits incomplete hands without creating cards or fatigue", () => {
    const state = initial();
    state.players[1]!.hand = [];
    state.players[1]!.drawPile = [];
    state.players[1]!.discard = [];
    const next = endTurn(state, 0, 1, 1, random).state;
    expect(next.players[1]!.hand).toEqual([]);
    expect(next.players[1]!.heroHp).toBe(30);
  });
  it("allows surrender during the opponent's turn", () => {
    expect(surrender(initial(), 1).state.winner).toBe(0);
  });
  it("preserves every unique card across complete simulated duels", () => {
    for (let seed = 1; seed <= 20; seed++) {
      let value = seed;
      const rng = () => {
        value = (Math.imul(1664525, value) + 1013904223) >>> 0;
        return value / 4294967296;
      };
      let state = createGame(
        [
          { userId: "alice", name: "Alice", cards: validateDeck(DEFAULT_DECK) },
          { userId: "bob", name: "Bob", cards: validateDeck(DEFAULT_DECK) },
        ],
        0,
        rng,
      );
      for (let turn = 0; turn < 200 && state.status === "active"; turn++) {
        const index = state.activePlayer;
        const player = state.players[index]!;
        const cells = Array.from({ length: 12 }, (_, i) => ({
          row: Math.floor(i / 3),
          depth: i % 3,
        })).filter(
          (cell) =>
            !player.board.some(
              (unit) => unit.row === cell.row && unit.depth === cell.depth,
            ),
        );
        if (player.hand.length && cells.length) {
          const cell = cells[Math.floor(rng() * cells.length)]!;
          state = summon(
            state,
            index,
            player.hand[Math.floor(rng() * player.hand.length)]!,
            cell.row,
            cell.depth,
            state.turn,
            turn * 1000,
          ).state;
        }
        state = endTurn(state, index, state.turn, turn * 1000 + 1, rng).state;
        for (const owner of state.players) {
          const ids = [
            ...owner.hand,
            ...owner.drawPile,
            ...owner.discard,
            ...owner.board.map((unit) => unit.cardId),
          ];
          expect(ids.sort()).toEqual([...DEFAULT_DECK].sort());
          expect(
            new Set(owner.board.map((unit) => `${unit.row}-${unit.depth}`))
              .size,
          ).toBe(owner.board.length);
          expect(owner.board.every((unit) => unit.hp > 0)).toBe(true);
        }
      }
      expect(state.status).toBe("finished");
    }
  });
});
