import {
  CATALOG,
  DEFAULT_DECK,
  DECK_SIZE,
  DEPTHS,
  ROWS,
  createGame,
  endTurn,
  shuffle,
  validateDeck,
  type GameState,
  type GameView,
  type PlayerState,
} from "./index";

export const PRACTICE_PLAYER_ID = "practice-player";
export const PRACTICE_COMPUTER_ID = "practice-computer";
export const PRACTICE_DEADLINE = Number.MAX_SAFE_INTEGER;

export function createPracticeGame(
  deckIds: readonly string[] = DEFAULT_DECK,
  now: number,
  random: () => number,
): GameState {
  const computerDeck = shuffle(CATALOG, random).slice(0, DECK_SIZE);
  const state = createGame(
    [
      { userId: PRACTICE_PLAYER_ID, name: "Toi", cards: validateDeck(deckIds) },
      {
        userId: PRACTICE_COMPUTER_ID,
        name: "Gardien mécanique",
        cards: computerDeck,
      },
    ],
    now,
    random,
  );
  state.activePlayer = 0;
  state.turnEndsAt = PRACTICE_DEADLINE;
  return state;
}

export interface ComputerMove {
  cardId: string;
  row: number;
  depth: number;
}

/** Reconstruct only known cards. The chooser never receives the human's hand. */
function visibleState(view: GameView): GameState {
  return {
    activePlayer: view.activePlayer,
    turn: view.turn,
    hasSummoned: view.hasSummoned,
    status: view.status,
    winner: view.winner,
    turnEndsAt: PRACTICE_DEADLINE,
    sequence: view.sequence,
    players: view.players.map((player, index) => ({
      userId: String(index),
      name: player.name,
      heroHp: player.heroHp,
      cards: [...player.hand, ...player.board.map((unit) => unit.card)],
      hand: player.hand.map((card) => card.id),
      drawPile: [],
      discard: [],
      board: player.board.map(({ cardId, row, depth, hp }) => ({
        cardId,
        row,
        depth,
        hp,
      })),
    })),
  };
}

function boardValue(player: PlayerState): number {
  return player.board.reduce((total, unit) => {
    const card = player.cards.find((entry) => entry.id === unit.cardId)!;
    return total + card.attack * 4 + unit.hp;
  }, 0);
}

function evaluate(state: GameState, computer: number): number {
  if (state.status === "finished")
    return state.winner === computer ? 1_000_000 : -1_000_000;
  const own = state.players[computer]!;
  const enemy = state.players[1 - computer]!;
  return (own.heroHp - enemy.heroHp) * 30 + boardValue(own) - boardValue(enemy);
}

/** Compare our attack and the visible counterattack for every legal placement. */
export function chooseComputerMove(
  view: GameView,
  random: () => number,
): ComputerMove | null {
  if (
    view.status !== "active" ||
    view.activePlayer !== view.me ||
    view.hasSummoned
  )
    return null;
  const own = view.players[view.me]!;
  const candidates: (ComputerMove | null)[] = [null];
  for (const card of own.hand)
    for (let row = 0; row < ROWS; row++)
      for (let depth = 0; depth < DEPTHS; depth++)
        if (!own.board.some((unit) => unit.row === row && unit.depth === depth))
          candidates.push({ cardId: card.id, row, depth });
  let bestScore = -Infinity;
  let best: (ComputerMove | null)[] = [];
  for (const move of candidates) {
    const state = visibleState(view);
    if (move) {
      const player = state.players[view.me]!;
      const card = player.cards.find((entry) => entry.id === move.cardId)!;
      player.hand = player.hand.filter((id) => id !== move.cardId);
      player.board.push({ ...move, hp: card.health });
    }
    const attack = endTurn(state, view.me, state.turn, 0, () => 0.5).state;
    // Take immediate wins before considering a counterattack.
    const result =
      attack.status === "finished"
        ? attack
        : endTurn(attack, 1 - view.me, attack.turn, 0, () => 0.5).state;
    const score = evaluate(result, view.me);
    if (score > bestScore) {
      bestScore = score;
      best = [move];
    } else if (score === bestScore) best.push(move);
  }
  return best[Math.floor(random() * best.length)] ?? null;
}
