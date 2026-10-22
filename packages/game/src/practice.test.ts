import { describe, expect, it } from "vitest";
import {
  DEFAULT_DECK,
  createGame,
  endTurn,
  isDeploymentDepth,
  playerView,
  summon,
  validateDeck,
  type GameState,
} from "./index";
import {
  PRACTICE_COMPUTER_ID,
  PRACTICE_DEADLINE,
  PRACTICE_PLAYER_ID,
  chooseComputerMove,
  createPracticeGame,
} from "./practice";

function initial() {
  const state = createGame(
    [
      {
        userId: PRACTICE_PLAYER_ID,
        name: "Toi",
        cards: validateDeck(DEFAULT_DECK),
      },
      {
        userId: PRACTICE_COMPUTER_ID,
        name: "Ordinateur",
        cards: validateDeck(DEFAULT_DECK),
      },
    ],
    0,
    () => 0.25,
  );
  state.activePlayer = 1;
  return state;
}
function choose(state: GameState) {
  return chooseComputerMove(
    playerView(state, PRACTICE_COMPUTER_ID),
    () => 0.25,
  );
}

describe("terrain d’entraînement", () => {
  it("starts the human first, with eight unique cards each, four in hand and no time pressure", () => {
    const deck = [...DEFAULT_DECK].reverse();
    const state = createPracticeGame(deck, 100, () => 0.25);
    expect(state.activePlayer).toBe(0);
    expect(state.turnEndsAt).toBe(PRACTICE_DEADLINE);
    expect(state.players[0]!.cards.map((card) => card.id)).toEqual(deck);
    for (const owner of state.players) {
      expect(new Set(owner.cards.map((card) => card.id)).size).toBe(8);
      expect(owner.hand).toHaveLength(4);
      expect(owner.drawPile).toHaveLength(4);
    }
    expect(playerView(state, PRACTICE_PLAYER_ID).players[1]!.hand).toEqual([]);
    expect(() => createPracticeGame(deck.slice(1), 0, () => 0.25)).toThrow(
      "8 cartes",
    );
  });
  it("evaluates legal moves without modifying the real game", () => {
    const state = initial();
    const before = structuredClone(state);
    const move = choose(state)!;
    expect(move).not.toBeNull();
    expect(state).toEqual(before);
    expect(state.players[1]!.hand).toContain(move.cardId);
    expect(() =>
      summon(state, 1, move.cardId, move.row, move.depth, 1, 1, () => 0.25),
    ).not.toThrow();
  });
  it("takes a lethal attack in an open row instead of hitting a blocker", () => {
    const state = initial();
    state.players[1]!.hand = ["fox"];
    state.players[0]!.heroHp = 5;
    state.players[0]!.board = [{ cardId: "guardian", row: 0, depth: 0, hp: 9 }];
    const move = choose(state)!;
    expect(move.cardId).toBe("fox");
    expect(move.row).not.toBe(0);
    const played = summon(
      state,
      1,
      move.cardId,
      move.row,
      move.depth,
      1,
      1,
      () => 0.25,
    ).state;
    expect(played.winner).toBe(1);
  });
  it("blocks a lethal visible attack rather than abandoning its hero", () => {
    const state = initial();
    state.players[1]!.hand = ["turtle"];
    state.players[1]!.heroHp = 5;
    state.players[0]!.board = [{ cardId: "fox", row: 2, depth: 0, hp: 3 }];
    expect(choose(state)!.row).toBe(2);
  });
  it("does not summon a second time or play outside its turn or after the result", () => {
    const state = initial();
    const move = choose(state)!;
    const played = summon(
      state,
      1,
      move.cardId,
      move.row,
      move.depth,
      1,
      1,
      () => 0.25,
    ).state;
    expect(choose(played)).toBeNull();
    expect(choose({ ...state, activePlayer: 0 })).toBeNull();
    expect(choose({ ...state, status: "finished", winner: 0 })).toBeNull();
    state.players[1]!.hand = [];
    expect(choose(state)).toBeNull();
  });
  it("uses only visible enemy information", () => {
    const first = initial();
    const second = structuredClone(first);
    second.players[0]!.hand.reverse();
    second.players[0]!.drawPile.reverse();
    expect(choose(first)).toEqual(choose(second));
  });
  it("finishes simulated training matches while conserving cards and legal positions", () => {
    for (let seed = 1; seed <= 8; seed++) {
      let value = seed;
      const random = () => {
        value = (Math.imul(1664525, value) + 1013904223) >>> 0;
        return value / 4294967296;
      };
      let state = createPracticeGame(DEFAULT_DECK, 0, random);
      const decks = state.players.map((owner) =>
        owner.cards.map((card) => card.id).sort(),
      );
      for (let turn = 0; turn < 200 && state.status === "active"; turn++) {
        const player = state.activePlayer;
        const move = chooseComputerMove(
          playerView(state, state.players[player]!.userId),
          random,
        );
        if (move)
          state = summon(
            state,
            player,
            move.cardId,
            move.row,
            move.depth,
            state.turn,
            turn * 100,
            random,
          ).state;
        else state = endTurn(
          state,
          player,
          state.turn,
          turn * 100 + 1,
          random,
        ).state;
        for (const [index, owner] of state.players.entries()) {
          expect(
            [
              ...owner.hand,
              ...owner.drawPile,
              ...owner.discard,
              ...owner.board.map((unit) => unit.cardId),
            ].sort(),
          ).toEqual(decks[index]);
          expect(owner.hand.length).toBeLessThanOrEqual(4);
          expect(owner.board.every((unit) => isDeploymentDepth(
            owner.cards.find((card) => card.id === unit.cardId)!, unit.depth,
          ))).toBe(true);
          expect(
            new Set(owner.board.map((unit) => `${unit.row}-${unit.depth}`))
              .size,
          ).toBe(owner.board.length);
        }
      }
      expect(state.status).toBe("finished");
    }
  });
});
