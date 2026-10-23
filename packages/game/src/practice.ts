import {
  CATALOG,
  DEFAULT_DECK,
  RARITIES,
  MAX_CARD_LEVEL,
  createGame,
  endTurn,
  legalPlacements,
  summon,
  shuffle,
  validateDeck,
  variantCard,
  getCombatType,
  type CardDefinition,
  type GameState,
  type GameView,
  type PlayerState,
} from "./index";
import { leagueAt } from "./leagues";

export const PRACTICE_PLAYER_ID = "practice-player";
export const PRACTICE_COMPUTER_ID = "practice-computer";
export const PRACTICE_DEADLINE = Number.MAX_SAFE_INTEGER;
export const COMPUTER_MEMORY_LENGTH = 3;

/** New creatures and upgrade ceilings follow the current league, not the best owned card. */
export function computerProfile(trophies: number) {
  const index = leagueAt(trophies).index;
  const baseIds = DEFAULT_DECK.map((id) => id.split(":")[0]!);
  if (index >= 1) baseIds.push("owl");
  if (index >= 2) baseIds.push("stag");
  if (index >= 4) baseIds.push("fox", "knight", "bear");
  if (index >= 8) baseIds.push("dragon", "wolf", "serpent");
  return {
    baseIds,
    maxLevel: Math.min(
      MAX_CARD_LEVEL,
      index < 28 ? 1 + Math.floor(index / 4) : index - 20,
    ),
    maxRarity: RARITIES[index < 8 ? 0 : index < 16 ? 1 : index < 24 ? 2 : 3]!,
  };
}

export function computerDeckForLeague(
  trophies: number,
  humanCards: readonly CardDefinition[],
  random: () => number,
): CardDefinition[] {
  const profile = computerProfile(trophies);
  const pool = CATALOG.filter((card) => profile.baseIds.includes(card.id));
  // A demoted player can retain more slots than their current league normally grants.
  for (const card of [...CATALOG].sort((a, b) => a.attack - b.attack)) {
    if (pool.length >= humanCards.length) break;
    if (!pool.some((entry) => entry.id === card.id)) pool.push(card);
  }
  const available = shuffle(pool, random);
  const maxRarity = RARITIES.indexOf(profile.maxRarity);
  return humanCards.map((reference, index) => {
    const type = index % 2 === 0 ? "melee" : "ranged";
    const position = available.findIndex(
      (card) => getCombatType(card) === type,
    );
    const [base] = available.splice(position < 0 ? 0 : position, 1);
    return variantCard(
      base!.id,
      RARITIES[
        Math.min(maxRarity, RARITIES.indexOf(reference.rarity ?? "common"))
      ]!,
      Math.min(profile.maxLevel, reference.level ?? 1),
    );
  });
}

export function createPracticeGame(
  deckIds: readonly string[] = DEFAULT_DECK,
  now: number,
  random: () => number,
): GameState {
  const humanCards = validateDeck(deckIds);
  const computerDeck = computerDeckForLeague(0, humanCards, random);
  const state = createGame(
    [
      { userId: PRACTICE_PLAYER_ID, name: "Toi", cards: humanCards },
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
      cards: player.deck.map((card) => ({ ...card })),
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
  recentCards: readonly string[] = [],
): ComputerMove | null {
  if (
    view.status !== "active" ||
    view.activePlayer !== view.me ||
    view.hasSummoned
  )
    return null;
  const own = view.players[view.me]!;
  const candidates: ComputerMove[] = [];
  for (const card of own.hand)
    for (const cell of legalPlacements(card, own.board))
      candidates.push({ cardId: card.id, ...cell });
  if (!candidates.length) return null;
  const rated: {
    move: ComputerMove;
    score: number;
    wins: boolean;
    loses: boolean;
  }[] = [];
  for (const move of candidates) {
    const state = visibleState(view);
    const attack = summon(
      state,
      view.me,
      move.cardId,
      move.row,
      move.depth,
      state.turn,
      0,
      () => 0.5,
    ).state;
    // Take immediate wins before considering a counterattack.
    const result =
      attack.status === "finished"
        ? attack
        : endTurn(attack, 1 - view.me, attack.turn, 0, () => 0.5).state;
    rated.push({
      move,
      score: evaluate(result, view.me),
      wins: attack.status === "finished" && attack.winner === view.me,
      loses: result.status === "finished" && result.winner !== view.me,
    });
  }
  const winners = rated.filter((candidate) => candidate.wins);
  const safe = rated.filter((candidate) => !candidate.loses);
  let choices = winners.length ? winners : safe.length ? safe : rated;
  if (!winners.length) {
    const last = recentCards[recentCards.length - 1];
    const alternatives = choices.filter(
      (candidate) => candidate.move.cardId !== last,
    );
    if (alternatives.length) choices = alternatives;
  }
  // Pick a creature before its placement: a creature with more free cells gets no extra lottery tickets.
  const byCard = new Map<string, { score: number; moves: ComputerMove[] }>();
  for (const candidate of choices) {
    const { move } = candidate;
    const repetitions = recentCards
      .slice(-COMPUTER_MEMORY_LENGTH)
      .filter((id) => id === move.cardId).length;
    const copiesOnBoard = own.board.filter(
      (unit) => unit.cardId === move.cardId,
    ).length;
    const score =
      candidate.score -
      (winners.length ? 0 : repetitions * 120 + copiesOnBoard * 35);
    const best = byCard.get(move.cardId);
    if (!best || score > best.score)
      byCard.set(move.cardId, { score, moves: [move] });
    else if (score === best.score) best.moves.push(move);
  }
  const options = [...byCard.values()];
  const bestScore = Math.max(...options.map((option) => option.score));
  const varied = options.filter((option) => option.score >= bestScore - 30);
  const chosen = varied[Math.floor(random() * varied.length)]!;
  return chosen.moves[Math.floor(random() * chosen.moves.length)] ?? null;
}
