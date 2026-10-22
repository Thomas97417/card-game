export const DECK_SIZE = 8;
export const HAND_SIZE = 4;
export const HERO_HP = 30;
export const ROWS = 4;
export const DEPTHS = 3;
export const TURN_MS = 60_000;

export interface CardDefinition {
  id: string;
  name: string;
  title: string;
  attack: number;
  health: number;
  color: string;
  kind: string;
}

export const CATALOG: readonly CardDefinition[] = [
  {
    id: "guardian",
    name: "Gardien de pierre",
    title: "Le silence des anciens",
    attack: 2,
    health: 9,
    color: "#78958a",
    kind: "golem",
  },
  {
    id: "fox",
    name: "Renard des braises",
    title: "Une étincelle suffit",
    attack: 5,
    health: 3,
    color: "#d6844d",
    kind: "fox",
  },
  {
    id: "owl",
    name: "Oracle des brumes",
    title: "Les yeux de la forêt",
    attack: 4,
    health: 4,
    color: "#8e86ad",
    kind: "owl",
  },
  {
    id: "stag",
    name: "Cerf couronné",
    title: "Souverain des clairières",
    attack: 4,
    health: 6,
    color: "#c1a267",
    kind: "stag",
  },
  {
    id: "mushroom",
    name: "Sentinelle mousse",
    title: "Petit, mais tenace",
    attack: 2,
    health: 8,
    color: "#b4706b",
    kind: "mushroom",
  },
  {
    id: "dragon",
    name: "Dragon d’ambre",
    title: "Le souffle du soleil",
    attack: 7,
    health: 1,
    color: "#dbab52",
    kind: "dragon",
  },
  {
    id: "turtle",
    name: "Tortue millénaire",
    title: "La patience est une arme",
    attack: 1,
    health: 12,
    color: "#83a575",
    kind: "turtle",
  },
  {
    id: "wisp",
    name: "Esprit des sources",
    title: "Un murmure dans l’eau",
    attack: 3,
    health: 5,
    color: "#70b7b1",
    kind: "wisp",
  },
  {
    id: "wolf",
    name: "Loup de lune",
    title: "Quand la nuit s’éveille",
    attack: 6,
    health: 2,
    color: "#9baec1",
    kind: "wolf",
  },
  {
    id: "knight",
    name: "Chevalier ronce",
    title: "Fidèle jusqu’au dernier jour",
    attack: 3,
    health: 8,
    color: "#769a7c",
    kind: "knight",
  },
  {
    id: "serpent",
    name: "Vipère de jade",
    title: "L’éclair sous les feuilles",
    attack: 5,
    health: 4,
    color: "#96af68",
    kind: "serpent",
  },
  {
    id: "bear",
    name: "Ours des cimes",
    title: "Le cœur de la montagne",
    attack: 4,
    health: 7,
    color: "#b79780",
    kind: "bear",
  },
];
export const DEFAULT_DECK = CATALOG.slice(0, DECK_SIZE).map((card) => card.id);

export class GameError extends Error {}

export function validateDeck(ids: readonly string[]): CardDefinition[] {
  if (ids.length !== DECK_SIZE)
    throw new GameError(
      `Un deck doit contenir exactement ${DECK_SIZE} cartes.`,
    );
  if (new Set(ids).size !== DECK_SIZE)
    throw new GameError("Chaque carte doit être unique dans le deck.");
  return ids.map((id) => {
    const card = CATALOG.find((entry) => entry.id === id);
    if (!card)
      throw new GameError("Cette carte n’existe pas dans le catalogue.");
    return { ...card };
  });
}

export interface Unit {
  cardId: string;
  row: number;
  depth: number;
  hp: number;
}
export interface PlayerState {
  userId: string;
  name: string;
  heroHp: number;
  cards: CardDefinition[];
  hand: string[];
  drawPile: string[];
  discard: string[];
  board: Unit[];
}
export interface GameState {
  players: PlayerState[];
  activePlayer: number;
  turn: number;
  hasSummoned: boolean;
  status: "active" | "finished";
  winner: number | null;
  turnEndsAt: number;
  sequence: number;
}
export interface GameEvent {
  seq: number;
  type: "summon" | "withdraw" | "attack" | "death" | "turn" | "victory";
  player: number;
  cardId?: string;
  row?: number;
  depth?: number;
  targetPlayer?: number;
  targetCardId?: string;
  damage?: number;
  hp?: number;
}
export interface Transition {
  state: GameState;
  events: GameEvent[];
}
export interface PlayerInput {
  userId: string;
  name: string;
  cards: CardDefinition[];
}

function cloneGame(input: GameState): GameState {
  return {
    ...input,
    players: input.players.map((player) => ({
      ...player,
      cards: player.cards.map((card) => ({ ...card })),
      hand: [...player.hand],
      drawPile: [...player.drawPile],
      discard: [...player.discard],
      board: player.board.map((unit) => ({ ...unit })),
    })),
  };
}

export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

function refill(player: PlayerState, random: () => number) {
  while (player.hand.length < HAND_SIZE) {
    if (!player.drawPile.length && player.discard.length) {
      player.drawPile = shuffle(player.discard, random);
      player.discard = [];
    }
    const next = player.drawPile.shift();
    if (!next) break;
    player.hand.push(next);
  }
}

export function createGame(
  players: PlayerInput[],
  now: number,
  random: () => number,
): GameState {
  if (players.length !== 2 || players[0]!.userId === players[1]!.userId)
    throw new GameError("Il faut deux joueurs différents.");
  const state: GameState = {
    players: players.map((player) => ({
      ...player,
      cards: player.cards.map((c) => ({ ...c })),
      heroHp: HERO_HP,
      hand: [],
      drawPile: shuffle(
        player.cards.map((c) => c.id),
        random,
      ),
      discard: [],
      board: [],
    })),
    activePlayer: random() < 0.5 ? 0 : 1,
    turn: 1,
    hasSummoned: false,
    status: "active",
    winner: null,
    turnEndsAt: now + TURN_MS,
    sequence: 0,
  };
  for (const player of state.players) refill(player, random);
  return state;
}

function checkTurn(state: GameState, player: number, turn: number) {
  if (state.status !== "active") throw new GameError("La partie est terminée.");
  if (state.turn !== turn) throw new GameError("Le tour a changé. Réessaie.");
  if (state.activePlayer !== player)
    throw new GameError("Ce n’est pas ton tour.");
}

function emit(
  state: GameState,
  events: GameEvent[],
  event: Omit<GameEvent, "seq">,
) {
  events.push({ ...event, seq: ++state.sequence });
}

export function summon(
  input: GameState,
  playerIndex: number,
  cardId: string,
  row: number,
  depth: number,
  turn: number,
  now: number,
): Transition {
  checkTurn(input, playerIndex, turn);
  if (now >= input.turnEndsAt)
    throw new GameError("Le temps du tour est écoulé.");
  if (input.hasSummoned)
    throw new GameError("Tu as déjà invoqué un monstre ce tour-ci.");
  if (
    !Number.isInteger(row) ||
    !Number.isInteger(depth) ||
    row < 0 ||
    row >= ROWS ||
    depth < 0 ||
    depth >= DEPTHS
  )
    throw new GameError("Cette case n’existe pas.");
  const state = cloneGame(input);
  const player = state.players[playerIndex]!;
  if (!player.hand.includes(cardId))
    throw new GameError("Cette carte n’est pas dans ta main.");
  if (player.board.some((unit) => unit.row === row && unit.depth === depth))
    throw new GameError("Cette case est occupée.");
  const card = player.cards.find((entry) => entry.id === cardId)!;
  player.hand.splice(player.hand.indexOf(cardId), 1);
  player.board.push({ cardId, row, depth, hp: card.health });
  state.hasSummoned = true;
  const events: GameEvent[] = [];
  emit(state, events, {
    type: "summon",
    player: playerIndex,
    cardId,
    row,
    depth,
  });
  return { state, events };
}

/** Withdrawing sends a creature to the discard pile and never refunds a summon. */
export function withdraw(
  input: GameState,
  playerIndex: number,
  cardId: string,
  turn: number,
  now: number,
): Transition {
  checkTurn(input, playerIndex, turn);
  if (now >= input.turnEndsAt)
    throw new GameError("Le temps du tour est écoulé.");
  const state = cloneGame(input);
  const player = state.players[playerIndex]!;
  const unit = player.board.find((entry) => entry.cardId === cardId);
  if (!unit) throw new GameError("Cette carte n’est pas dans ton camp.");
  player.board = player.board.filter((entry) => entry !== unit);
  player.discard.push(cardId);
  const events: GameEvent[] = [];
  emit(state, events, {
    type: "withdraw",
    player: playerIndex,
    cardId,
    row: unit.row,
    depth: unit.depth,
  });
  return { state, events };
}

export function endTurn(
  input: GameState,
  playerIndex: number,
  turn: number,
  now: number,
  random: () => number,
): Transition {
  checkTurn(input, playerIndex, turn);
  const state = cloneGame(input);
  const events: GameEvent[] = [];
  const attacker = state.players[playerIndex]!;
  const opponentIndex = 1 - playerIndex;
  const defender = state.players[opponentIndex]!;
  const attackers = [...attacker.board].sort(
    (a, b) => a.row - b.row || a.depth - b.depth,
  );
  for (const unit of attackers) {
    const card = attacker.cards.find((entry) => entry.id === unit.cardId)!;
    const target = defender.board
      .filter((other) => other.row === unit.row)
      .sort((a, b) => a.depth - b.depth)[0];
    if (target) {
      target.hp = Math.max(0, target.hp - card.attack);
      emit(state, events, {
        type: "attack",
        player: playerIndex,
        cardId: card.id,
        row: unit.row,
        depth: unit.depth,
        targetPlayer: opponentIndex,
        targetCardId: target.cardId,
        damage: card.attack,
        hp: target.hp,
      });
      if (target.hp === 0) {
        defender.board = defender.board.filter((other) => other !== target);
        defender.discard.push(target.cardId);
        emit(state, events, {
          type: "death",
          player: opponentIndex,
          cardId: target.cardId,
          row: target.row,
          depth: target.depth,
        });
      }
    } else {
      defender.heroHp = Math.max(0, defender.heroHp - card.attack);
      emit(state, events, {
        type: "attack",
        player: playerIndex,
        cardId: card.id,
        row: unit.row,
        depth: unit.depth,
        targetPlayer: opponentIndex,
        damage: card.attack,
        hp: defender.heroHp,
      });
      if (defender.heroHp === 0) {
        state.status = "finished";
        state.winner = playerIndex;
        emit(state, events, { type: "victory", player: playerIndex });
        return { state, events };
      }
    }
  }
  state.activePlayer = opponentIndex;
  state.turn++;
  state.hasSummoned = false;
  state.turnEndsAt = now + TURN_MS;
  refill(defender, random);
  emit(state, events, { type: "turn", player: opponentIndex });
  return { state, events };
}

export function surrender(input: GameState, playerIndex: number): Transition {
  if (input.status !== "active") throw new GameError("La partie est terminée.");
  const state = cloneGame(input);
  state.status = "finished";
  state.winner = 1 - playerIndex;
  const events: GameEvent[] = [];
  emit(state, events, { type: "victory", player: state.winner });
  return { state, events };
}

export function playerView(state: GameState, userId: string) {
  const me = state.players.findIndex((player) => player.userId === userId);
  if (me === -1) throw new GameError("Tu ne participes pas à cette partie.");
  return {
    activePlayer: state.activePlayer,
    turn: state.turn,
    hasSummoned: state.hasSummoned,
    status: state.status,
    winner: state.winner,
    turnEndsAt: state.turnEndsAt,
    sequence: state.sequence,
    me,
    players: state.players.map((player, index) => ({
      name: player.name,
      heroHp: player.heroHp,
      board: player.board.map((unit) => ({
        ...unit,
        card: player.cards.find((card) => card.id === unit.cardId)!,
      })),
      hand:
        index === me
          ? player.hand.map(
              (id) => player.cards.find((card) => card.id === id)!,
            )
          : [],
      handCount: player.hand.length,
      drawCount: player.drawPile.length,
      discardCount: player.discard.length,
    })),
  };
}
export type GameView = ReturnType<typeof playerView>;
