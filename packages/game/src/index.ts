export const DECK_SIZE = 8;
export const MIN_DECK_SIZE = 4;
export const MAX_CARD_LEVEL = 10;
export const HAND_SIZE = 4;
export const HERO_HP = 30;
export const ROWS = 4;
export const DEPTHS = 3;
export const FRONT_DEPTHS = 2;
export const TURN_MS = 60_000;

export type CombatType = "melee" | "ranged";
export type CardRarity = "common" | "rare" | "epic" | "legendary";
export const RARITIES: readonly CardRarity[] = [
  "common",
  "rare",
  "epic",
  "legendary",
];
export const RARITY_LABELS: Record<CardRarity, string> = {
  common: "Commune",
  rare: "Rare",
  epic: "Épique",
  legendary: "Légendaire",
};

export interface CardDefinition {
  id: string;
  name: string;
  title: string;
  attack: number;
  health: number;
  color: string;
  kind: string;
  /** Older saved matches infer their combat type from the catalogue. */
  combatType?: CombatType;
  baseId?: string;
  rarity?: CardRarity;
  level?: number;
}
export interface OwnedCard {
  card: CardDefinition;
  copies: number;
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
    combatType: "melee",
  },
  {
    id: "fox",
    name: "Renard des braises",
    title: "Une étincelle suffit",
    attack: 5,
    health: 3,
    color: "#d6844d",
    kind: "fox",
    combatType: "ranged",
  },
  {
    id: "owl",
    name: "Oracle des brumes",
    title: "Les yeux de la forêt",
    attack: 4,
    health: 4,
    color: "#8e86ad",
    kind: "owl",
    combatType: "ranged",
  },
  {
    id: "stag",
    name: "Cerf couronné",
    title: "Souverain des clairières",
    attack: 4,
    health: 6,
    color: "#c1a267",
    kind: "stag",
    combatType: "melee",
  },
  {
    id: "mushroom",
    name: "Sentinelle mousse",
    title: "Petit, mais tenace",
    attack: 2,
    health: 8,
    color: "#b4706b",
    kind: "mushroom",
    combatType: "ranged",
  },
  {
    id: "dragon",
    name: "Dragon d’ambre",
    title: "Le souffle du soleil",
    attack: 7,
    health: 1,
    color: "#dbab52",
    kind: "dragon",
    combatType: "ranged",
  },
  {
    id: "turtle",
    name: "Tortue millénaire",
    title: "La patience est une arme",
    attack: 1,
    health: 12,
    color: "#83a575",
    kind: "turtle",
    combatType: "melee",
  },
  {
    id: "wisp",
    name: "Esprit des sources",
    title: "Un murmure dans l’eau",
    attack: 3,
    health: 5,
    color: "#70b7b1",
    kind: "wisp",
    combatType: "ranged",
  },
  {
    id: "wolf",
    name: "Loup de lune",
    title: "Quand la nuit s’éveille",
    attack: 6,
    health: 2,
    color: "#9baec1",
    kind: "wolf",
    combatType: "melee",
  },
  {
    id: "knight",
    name: "Chevalier ronce",
    title: "Fidèle jusqu’au dernier jour",
    attack: 3,
    health: 8,
    color: "#769a7c",
    kind: "knight",
    combatType: "melee",
  },
  {
    id: "serpent",
    name: "Vipère de jade",
    title: "L’éclair sous les feuilles",
    attack: 5,
    health: 4,
    color: "#96af68",
    kind: "serpent",
    combatType: "ranged",
  },
  {
    id: "bear",
    name: "Ours des cimes",
    title: "Le cœur de la montagne",
    attack: 4,
    health: 7,
    color: "#b79780",
    kind: "bear",
    combatType: "melee",
  },
];
export const DEFAULT_DECK = [
  "guardian:common",
  "turtle:common",
  "mushroom:common",
  "wisp:common",
];

export function variantCard(
  baseId: string,
  rarity: CardRarity,
  level = 1,
): CardDefinition {
  const base = CATALOG.find((card) => card.id === baseId);
  if (
    !base ||
    !RARITIES.includes(rarity) ||
    !Number.isInteger(level) ||
    level < 1 ||
    level > MAX_CARD_LEVEL
  )
    throw new GameError("Cette variante de carte n’existe pas.");
  const bonus = { common: 0, rare: 1, epic: 2, legendary: 4 }[rarity];
  return {
    ...base,
    id: `${baseId}:${rarity}`,
    baseId,
    rarity,
    level,
    attack: base.attack + bonus + level - 1,
    health: base.health + bonus * 2 + (level - 1) * 2,
  };
}

/** Bare IDs remain readable in already-started games and local practice links. */
export function resolveCard(id: string, level = 1): CardDefinition {
  if (!id.includes(":")) {
    const base = CATALOG.find((card) => card.id === id);
    if (!base)
      throw new GameError("Cette carte n’existe pas dans le catalogue.");
    return { ...base };
  }
  const [baseId, rarity, extra] = id.split(":");
  if (extra !== undefined)
    throw new GameError("Cette variante de carte n’existe pas.");
  return variantCard(baseId!, rarity as CardRarity, level);
}

export function upgradeCost(level: number) {
  return level * 5;
}
export function baseCardId(card: CardDefinition) {
  return card.baseId ?? card.id.split(":")[0]!;
}

export function getCombatType(card: CardDefinition): CombatType {
  return (
    card.combatType ??
    CATALOG.find((entry) => entry.id === baseCardId(card))?.combatType ??
    "melee"
  );
}

export function combatTypeLabel(card: CardDefinition): string {
  return getCombatType(card) === "melee" ? "Corps à corps" : "À distance";
}

/** Depth zero faces the enemy for both players; the last depth faces the hero. */
export function isDeploymentDepth(
  card: CardDefinition,
  depth: number,
): boolean {
  return (
    Number.isInteger(depth) &&
    depth >= 0 &&
    depth < DEPTHS &&
    (getCombatType(card) === "melee"
      ? depth < FRONT_DEPTHS
      : depth >= DEPTHS - FRONT_DEPTHS)
  );
}

export function legalPlacements(card: CardDefinition, board: readonly Unit[]) {
  return Array.from({ length: ROWS * DEPTHS }, (_, index) => ({
    row: Math.floor(index / DEPTHS),
    depth: index % DEPTHS,
  })).filter(
    ({ row, depth }) =>
      isDeploymentDepth(card, depth) &&
      !board.some((unit) => unit.row === row && unit.depth === depth),
  );
}

export function isMeleeBlocked(
  unit: Unit,
  board: readonly Unit[],
  cards: readonly CardDefinition[],
): boolean {
  const card = cards.find((entry) => entry.id === unit.cardId)!;
  return (
    getCombatType(card) === "melee" &&
    board.some(
      (other) =>
        other.row === unit.row &&
        other.depth < unit.depth &&
        getCombatType(cards.find((entry) => entry.id === other.cardId)!) ===
          "melee",
    )
  );
}

export class GameError extends Error {}

export function validateDeck(ids: readonly string[]): CardDefinition[] {
  if (ids.length < MIN_DECK_SIZE || ids.length > DECK_SIZE)
    throw new GameError(
      `Un deck doit contenir de ${MIN_DECK_SIZE} à ${DECK_SIZE} cartes.`,
    );
  if (new Set(ids).size !== ids.length)
    throw new GameError("Chaque carte doit être unique dans le deck.");
  return ids.map((id) => resolveCard(id));
}

export interface Unit {
  cardId: string;
  row: number;
  depth: number;
  hp: number;
}
export type UnitPosition = Pick<Unit, "row" | "depth">;
export interface PlayerState {
  userId: string;
  name: string;
  heroHp: number;
  cards: CardDefinition[];
  hand: string[];
  /** Variants outside the hand, all eligible even while deployed. */
  drawPile: string[];
  /** Kept empty for compatibility with saved games from the finite-deck rules. */
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
  targetRow?: number;
  targetDepth?: number;
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
  const held = new Set(player.hand);
  const available = shuffle(
    [...new Set(player.cards.map((card) => card.id))].filter(
      (id) => !held.has(id),
    ),
    random,
  );
  while (player.hand.length < HAND_SIZE) {
    const next = available.shift();
    if (!next) break;
    player.hand.push(next);
  }
  player.drawPile = available;
  player.discard = [];
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
      cards: player.cards.map((c) => ({ ...c, combatType: getCombatType(c) })),
      heroHp: HERO_HP,
      hand: [],
      drawPile: [],
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
  random: () => number,
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
  if (!isDeploymentDepth(card, depth))
    throw new GameError(
      getCombatType(card) === "melee"
        ? "Une unité au corps à corps doit être placée dans les deux colonnes vers l’ennemi."
        : "Une unité à distance doit être placée dans les deux colonnes vers ton héros.",
    );
  player.hand.splice(player.hand.indexOf(cardId), 1);
  player.board.push({ cardId, row, depth, hp: card.health });
  refill(player, random);
  state.hasSummoned = true;
  const events: GameEvent[] = [];
  emit(state, events, {
    type: "summon",
    player: playerIndex,
    cardId,
    row,
    depth,
  });
  const resolved = endTurn(state, playerIndex, turn, now, random);
  return { state: resolved.state, events: [...events, ...resolved.events] };
}

/** Remove only the selected creature; the hand and reusable deck are unchanged. */
export function withdraw(
  input: GameState,
  playerIndex: number,
  cardId: string,
  turn: number,
  now: number,
  position?: UnitPosition,
): Transition {
  checkTurn(input, playerIndex, turn);
  if (now >= input.turnEndsAt)
    throw new GameError("Le temps du tour est écoulé.");
  const state = cloneGame(input);
  const player = state.players[playerIndex]!;
  const matches = player.board.filter(
    (entry) =>
      entry.cardId === cardId &&
      (!position ||
        (entry.row === position.row && entry.depth === position.depth)),
  );
  if (matches.length > 1)
    throw new GameError("Choisis la créature à retirer sur le terrain.");
  const unit = matches[0];
  if (!unit) throw new GameError("Cette carte n’est pas dans ton camp.");
  player.board = player.board.filter((entry) => entry !== unit);
  player.discard = [];
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
    if (isMeleeBlocked(unit, attacker.board, attacker.cards)) continue;
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
        targetRow: target.row,
        targetDepth: target.depth,
        damage: card.attack,
        hp: target.hp,
      });
      if (target.hp === 0) {
        defender.board = defender.board.filter((other) => other !== target);
        defender.discard = [];
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
      // Deck composition is public; hand contents and draw order stay private.
      deck: player.cards.map((card) => ({ ...card })),
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
