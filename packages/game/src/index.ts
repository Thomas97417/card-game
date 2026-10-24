export * from "./cards";
export * from "./field";
import { populateField, type FieldBuildingKind } from "./field";
import {
  GameError,
  resolveCard,
  cloneCard,
  getCombatType,
  type CardDefinition,
  type CardAbility,
} from "./cards";
export const DECK_SIZE = 8;
export const MIN_DECK_SIZE = 4;
export const HAND_SIZE = 4;
export const HERO_HP = 30;
export const ROWS = 4;
export const DEPTHS = 3;
export const FRONT_DEPTHS = 2;
export const TURN_MS = 60_000;

/** Depth zero faces the enemy for both players; the last depth faces the hero. */
export function isDeploymentDepth(
  card: CardDefinition,
  depth: number,
): boolean {
  return (
    Number.isInteger(depth) &&
    depth >= 0 &&
    depth < DEPTHS &&
    (getCombatType(card) === "building" ||
      (getCombatType(card) === "melee"
        ? depth < FRONT_DEPTHS
        : depth >= DEPTHS - FRONT_DEPTHS))
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
  const card = unitCard(unit, cards);
  return (
    getCombatType(card) === "melee" &&
    board.some((other) => other.row === unit.row && other.depth < unit.depth)
  );
}

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
  /** Per-instance combat modifiers; optional for old saved matches. */
  attack?: number;
  maxHp?: number;
  block?: number;
  spikes?: number;
  vampirism?: number;
  regeneration?: number;
  shield?: boolean;
  temporaryAttack?: number;
  /** Definitions for summoned tokens and scenery outside the collectible deck. */
  definition?: CardDefinition;
  /** Neutral scenery present at creation; cannot be voluntarily withdrawn. */
  fieldObject?: FieldBuildingKind;
}
export interface Rune {
  row: number;
  depth: number;
  health: number;
}
export interface Pentagram {
  row: number;
  depth: number;
  attack: number;
}
export function unitCard(
  unit: Unit,
  cards: readonly CardDefinition[],
): CardDefinition {
  const card =
    unit.definition ?? cards.find((entry) => entry.id === unit.cardId);
  if (!card)
    throw new GameError("La définition de cette unité est introuvable.");
  return card;
}
export function unitMaxHp(unit: Unit, cards: readonly CardDefinition[]) {
  return unit.maxHp ?? unitCard(unit, cards).health;
}
export function unitAttack(
  unit: Unit,
  owner: Pick<PlayerState, "cards" | "board">,
) {
  const card = unitCard(unit, owner.cards);
  const synergy = (card.abilities ?? [])
    .filter((a) => a.active && a.effect === "attack_per_ally")
    .reduce(
      (total, a) =>
        total +
        a.value *
          owner.board.filter(
            (other) =>
              other !== unit &&
              other.hp > 0 &&
              unitCard(other, owner.cards).faction === "order",
          ).length,
      0,
    );
  return Math.max(0, (unit.attack ?? card.attack) + synergy);
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
  runes?: Rune[];
  pentagrams?: Pentagram[];
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
  type:
    | "summon"
    | "withdraw"
    | "attack"
    | "death"
    | "turn"
    | "victory"
    | "ability";
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
  ability?: string;
  amount?: number;
  unit?: Unit;
  runes?: Rune[];
  pentagrams?: Pentagram[];
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
      cards: player.cards.map(cloneCard),
      hand: [...player.hand],
      drawPile: [...player.drawPile],
      discard: [...player.discard],
      board: player.board.map((unit) => ({
        ...unit,
        ...(unit.definition ? { definition: cloneCard(unit.definition) } : {}),
      })),
      ...(player.runes ? { runes: player.runes.map((r) => ({ ...r })) } : {}),
      ...(player.pentagrams
        ? { pentagrams: player.pentagrams.map((p) => ({ ...p })) }
        : {}),
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
  options: { field?: boolean } = {},
): GameState {
  if (players.length !== 2 || players[0]!.userId === players[1]!.userId)
    throw new GameError("Il faut deux joueurs différents.");
  const state: GameState = {
    players: players.map((player) => ({
      ...player,
      cards: player.cards.map((c) => ({
        ...cloneCard(c),
        combatType: getCombatType(c),
      })),
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
  if (options.field !== false) populateField(state.players, random);
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
  const unit: Unit = { cardId, row, depth, hp: card.health };
  initializePassives(unit, card);
  player.board.push(unit);
  refill(player, random);
  state.hasSummoned = true;
  const events: GameEvent[] = [];
  emit(state, events, {
    type: "summon",
    player: playerIndex,
    cardId,
    row,
    depth,
    unit: { ...unit },
  });
  applyAbilities(state, playerIndex, unit, "deploy", events, random);
  appeared(state, playerIndex, unit, events, random);
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
  if (unit.fieldObject)
    throw new GameError(
      "Un bâtiment neutre doit être détruit pour libérer sa case.",
    );
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

function activeAbilities(
  unit: Unit,
  owner: PlayerState,
  trigger?: CardAbility["trigger"],
) {
  return (unitCard(unit, owner.cards).abilities ?? []).filter(
    (a) => a.active && (!trigger || a.trigger === trigger),
  );
}
function initializePassives(unit: Unit, card: CardDefinition) {
  for (const a of card.abilities ?? []) {
    if (!a.active || a.trigger !== "passive") continue;
    if (a.effect === "shield") unit.shield = true;
    if (
      a.effect === "block" ||
      a.effect === "spikes" ||
      a.effect === "vampirism" ||
      a.effect === "regeneration"
    )
      unit[a.effect] = a.value;
  }
}
function snapshot(unit: Unit): Unit {
  return {
    ...unit,
    ...(unit.definition ? { definition: cloneCard(unit.definition) } : {}),
  };
}
function effectEvent(
  state: GameState,
  events: GameEvent[],
  player: number,
  source: Unit,
  ability: string,
  targetPlayer: number,
  target?: Unit,
  amount = 0,
) {
  emit(state, events, {
    type: "ability",
    player,
    cardId: source.cardId,
    row: source.row,
    depth: source.depth,
    ability,
    amount,
    targetPlayer,
    ...(target
      ? {
          targetCardId: target.cardId,
          targetRow: target.row,
          targetDepth: target.depth,
          hp: target.hp,
          unit: snapshot(target),
        }
      : { hp: state.players[targetPlayer]!.heroHp }),
  });
}
function healUnit(
  state: GameState,
  events: GameEvent[],
  player: number,
  source: Unit,
  target: Unit,
  amount: number,
  label: string,
) {
  const owner = state.players[player]!;
  const healed = Math.min(
    amount,
    Math.max(0, unitMaxHp(target, owner.cards) - target.hp),
  );
  if (target.hp <= 0 || healed <= 0) return;
  target.hp += healed;
  effectEvent(state, events, player, source, label, player, target, healed);
}
function pick<T>(items: T[], random: () => number): T[] {
  return items.length
    ? [items[Math.min(items.length - 1, Math.floor(random() * items.length))]!]
    : [];
}
function targets(
  state: GameState,
  player: number,
  source: Unit,
  a: CardAbility,
  random: () => number,
): Unit[] {
  const owner = state.players[player]!;
  const allies = owner.board.filter((u) => u !== source && u.hp > 0);
  const card = (u: Unit) => unitCard(u, owner.cards);
  switch (a.target) {
    case "self":
      return source.hp > 0 ? [source] : [];
    case "random_ally":
      return pick(allies, random);
    case "random_zombie":
      return pick(
        allies.filter((u) => card(u).kind === "zombie"),
        random,
      );
    case "column_allies":
      return allies.filter((u) => u.depth === source.depth);
    case "row_allies":
      return allies.filter((u) => u.row === source.row);
    case "melee_allies":
      return allies.filter((u) => getCombatType(card(u)) === "melee");
    case "nature_allies":
      return allies.filter((u) => card(u).faction === "nature");
    case "order_allies":
      return allies.filter((u) => card(u).faction === "order");
    case "ally_buildings":
      return allies.filter((u) => getCombatType(card(u)) === "building");
    case "all_allies":
      return allies;
    case "all_enemies":
      return state.players[1 - player]!.board.filter((u) => u.hp > 0);
    default:
      return [];
  }
}
function tokenDefinition(
  source: CardDefinition,
  spec: NonNullable<CardAbility["summon"]>,
): CardDefinition {
  const archer = spec.kind === "archer";
  const pierce = [
    [5, 2],
    [8, 4],
    [11, 7],
    [14, 13],
    [17, 21],
    [20, 32],
    [23, 46],
    [26, 64],
  ]
    .reverse()
    .find(([level]) => spec.level >= level!);
  return {
    id: `token-${spec.kind}-${source.id}-${spec.level}`,
    baseId: archer ? "fox" : "sporeling",
    name: archer ? "Éclaireur des braises" : "Rejeton des spores",
    title: "Renfort invoqué",
    kind: archer ? "archer" : "zombie",
    color: archer ? "#d6844d" : "#9f79a4",
    attack: spec.attack,
    health: spec.health,
    level: spec.level,
    rarity: "common",
    faction: archer ? "order" : "chaos",
    combatType: archer ? "ranged" : "melee",
    abilities:
      archer && pierce
        ? [
            {
              id: "pierce",
              name: "Perforation",
              description: `Inflige ${pierce[1]} dégâts aux ennemis de la colonne de la cible.`,
              unlockLevel: 5,
              active: true,
              effect: "pierce",
              trigger: "passive",
              target: "self",
              value: pierce[1]!,
            },
          ]
        : [],
  };
}
function appeared(
  state: GameState,
  player: number,
  unit: Unit,
  events: GameEvent[],
  random: () => number,
) {
  const owner = state.players[player]!;
  if (unitCard(unit, owner.cards).faction === "nature") {
    for (const ally of [...owner.board]) {
      if (ally !== unit && ally.hp > 0)
        applyAbilities(
          state,
          player,
          ally,
          "nature_ally_appears",
          events,
          random,
        );
    }
  }
  const rune = owner.runes?.find(
    (r) => r.row === unit.row && r.depth === unit.depth,
  );
  if (rune) {
    unit.maxHp = unitMaxHp(unit, owner.cards) + rune.health;
    unit.hp += rune.health;
    owner.runes = owner.runes!.filter((r) => r !== rune);
    effectEvent(
      state,
      events,
      player,
      unit,
      "Rune de vie",
      player,
      unit,
      rune.health,
    );
    events[events.length - 1]!.runes = owner.runes.map((r) => ({ ...r }));
  }
  const pentagram = owner.pentagrams?.find(
    (p) => p.row === unit.row && p.depth === unit.depth,
  );
  if (pentagram) {
    unit.attack =
      (unit.attack ?? unitCard(unit, owner.cards).attack) + pentagram.attack;
    owner.pentagrams = owner.pentagrams!.filter((p) => p !== pentagram);
    effectEvent(
      state,
      events,
      player,
      unit,
      "Pentagramme de puissance",
      player,
      unit,
      pentagram.attack,
    );
    events[events.length - 1]!.pentagrams = owner.pentagrams.map((p) => ({
      ...p,
    }));
  }
}
function applyAbilities(
  state: GameState,
  player: number,
  source: Unit,
  trigger: CardAbility["trigger"],
  events: GameEvent[],
  random: () => number,
) {
  const owner = state.players[player]!;
  for (const a of activeAbilities(source, owner, trigger)) {
    if (a.effect === "summon" && a.summon) {
      const depth = source.depth + (a.summon.kind === "archer" ? 1 : -1);
      if (
        depth < 0 ||
        depth >= DEPTHS ||
        owner.board.some((u) => u.row === source.row && u.depth === depth)
      )
        continue;
      const definition = tokenDefinition(
        unitCard(source, owner.cards),
        a.summon,
      );
      const unit: Unit = {
        cardId: definition.id,
        row: source.row,
        depth,
        hp: definition.health,
        definition,
      };
      initializePassives(unit, definition);
      owner.board.push(unit);
      emit(state, events, {
        type: "summon",
        player,
        cardId: unit.cardId,
        row: unit.row,
        depth,
        unit: snapshot(unit),
        ability: a.name,
      });
      appeared(state, player, unit, events, random);
      continue;
    }
    if (a.effect === "rune") {
      const cells = Array.from({ length: ROWS * DEPTHS }, (_, i) => ({
        row: Math.floor(i / DEPTHS),
        depth: i % DEPTHS,
      })).filter(
        (cell) =>
          !owner.board.some(
            (u) => u.row === cell.row && u.depth === cell.depth,
          ) &&
          !owner.runes?.some(
            (r) => r.row === cell.row && r.depth === cell.depth,
          ) &&
          !owner.pentagrams?.some(
            (p) => p.row === cell.row && p.depth === cell.depth,
          ),
      );
      const cell = pick(cells, random)[0];
      if (cell) {
        owner.runes = [...(owner.runes ?? []), { ...cell, health: a.value }];
        effectEvent(
          state,
          events,
          player,
          source,
          a.name,
          player,
          undefined,
          a.value,
        );
        events[events.length - 1]!.runes = owner.runes.map((r) => ({ ...r }));
      }
      continue;
    }
    if (a.target === "ally_hero" && a.effect === "heal") {
      const healed = Math.max(0, Math.min(a.value, HERO_HP - owner.heroHp));
      if (healed) {
        owner.heroHp += healed;
        effectEvent(
          state,
          events,
          player,
          source,
          a.name,
          player,
          undefined,
          healed,
        );
      }
      continue;
    }
    const targetPlayer = a.target === "all_enemies" ? 1 - player : player;
    const targetOwner = state.players[targetPlayer]!;
    for (const target of targets(state, player, source, a, random)) {
      if (a.effect === "heal") {
        healUnit(state, events, player, source, target, a.value, a.name);
        continue;
      }
      if (a.effect === "attack") {
        target.attack = Math.max(
          0,
          (target.attack ?? unitCard(target, targetOwner.cards).attack) +
            a.value,
        );
        if (a.temporary)
          target.temporaryAttack = (target.temporaryAttack ?? 0) + a.value;
      } else if (a.effect === "health") {
        target.maxHp = unitMaxHp(target, targetOwner.cards) + a.value;
        target.hp += a.value;
      } else if (
        a.effect === "block" ||
        a.effect === "spikes" ||
        a.effect === "vampirism" ||
        a.effect === "regeneration"
      ) {
        target[a.effect] = (target[a.effect] ?? 0) + a.value;
      } else continue;
      effectEvent(
        state,
        events,
        player,
        source,
        a.name,
        targetPlayer,
        target,
        a.value,
      );
    }
  }
}
function damageUnit(
  state: GameState,
  events: GameEvent[],
  player: number,
  source: Unit,
  targetPlayer: number,
  target: Unit,
  amount: number,
  physical: boolean,
  label?: string,
) {
  const shielded = target.shield === true;
  if (shielded) target.shield = false;
  const damage = shielded
    ? 0
    : Math.min(
        target.hp,
        Math.max(0, amount - (physical ? (target.block ?? 0) : 0)),
      );
  target.hp = Math.max(0, target.hp - damage);
  if (physical) {
    emit(state, events, {
      type: "attack",
      player,
      cardId: source.cardId,
      row: source.row,
      depth: source.depth,
      targetPlayer,
      targetCardId: target.cardId,
      targetRow: target.row,
      targetDepth: target.depth,
      damage,
      hp: target.hp,
      unit: snapshot(target),
      ...(shielded ? { ability: "Bouclier mental" } : {}),
    });
  } else
    effectEvent(
      state,
      events,
      player,
      source,
      shielded ? "Bouclier mental" : label!,
      targetPlayer,
      target,
      -damage,
    );
  return damage;
}
function removeDead(
  state: GameState,
  events: GameEvent[],
  random: () => number,
) {
  for (const [player, owner] of state.players.entries()) {
    for (const dead of [...owner.board].filter((u) => u.hp <= 0)) {
      owner.board = owner.board.filter((u) => u !== dead);
      emit(state, events, {
        type: "death",
        player,
        cardId: dead.cardId,
        row: dead.row,
        depth: dead.depth,
      });
      applyAbilities(state, player, dead, "death", events, random);
    }
  }
}
function heroDamage(
  state: GameState,
  events: GameEvent[],
  player: number,
  unit: Unit,
  amount: number,
  ability?: string,
) {
  const targetPlayer = 1 - player;
  const defender = state.players[targetPlayer]!;
  const damage = Math.min(defender.heroHp, Math.max(0, amount));
  defender.heroHp -= damage;
  emit(state, events, {
    type: ability ? "ability" : "attack",
    player,
    cardId: unit.cardId,
    row: unit.row,
    depth: unit.depth,
    targetPlayer,
    damage,
    amount: -damage,
    hp: defender.heroHp,
    ...(ability ? { ability } : {}),
  });
  return damage;
}
function victory(state: GameState, events: GameEvent[]) {
  const loser = state.players.findIndex((p) => p.heroHp <= 0);
  if (loser < 0) return false;
  state.status = "finished";
  state.winner = 1 - loser;
  emit(state, events, { type: "victory", player: state.winner });
  return true;
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
  const ordered = (board: Unit[]) =>
    [...board].sort((a, b) => a.row - b.row || a.depth - b.depth);
  for (const unit of ordered(attacker.board)) {
    if (unit.hp <= 0 || !attacker.board.includes(unit)) continue;
    const card = unitCard(unit, attacker.cards);
    if (
      getCombatType(card) === "building" ||
      isMeleeBlocked(unit, attacker.board, attacker.cards)
    )
      continue;
    const passives = activeAbilities(unit, attacker, "passive");
    const attacks =
      1 +
      passives
        .filter((a) => a.effect === "extra_attack")
        .reduce((n, a) => n + a.value, 0);
    for (
      let hit = 0;
      hit < attacks && unit.hp > 0 && attacker.board.includes(unit);
      hit++
    ) {
      const power = unitAttack(unit, attacker);
      if (power <= 0) break;
      const target = ordered(defender.board).find(
        (other) => other.row === unit.row && other.hp > 0,
      );
      if (target) {
        damageUnit(
          state,
          events,
          playerIndex,
          unit,
          opponentIndex,
          target,
          power,
          true,
        );
        for (const a of passives.filter((a) => a.effect === "pierce")) {
          for (const pierced of ordered(defender.board).filter(
            (other) => other.depth === target.depth && other.hp > 0,
          ))
            damageUnit(
              state,
              events,
              playerIndex,
              unit,
              opponentIndex,
              pierced,
              a.value,
              false,
              a.name,
            );
        }
        if ((unit.vampirism ?? 0) > 0 && target.hp > 0) {
          const drained = damageUnit(
            state,
            events,
            playerIndex,
            unit,
            opponentIndex,
            target,
            unit.vampirism!,
            false,
            "Vampirisme",
          );
          healUnit(
            state,
            events,
            playerIndex,
            unit,
            unit,
            drained,
            "Vampirisme",
          );
        }
        // Attacked effects resolve before deaths, including lethal counter-damage.
        if ((target.spikes ?? 0) > 0 && unit.hp > 0)
          damageUnit(
            state,
            events,
            opponentIndex,
            target,
            playerIndex,
            unit,
            target.spikes!,
            false,
            "Épines",
          );
      } else {
        heroDamage(state, events, playerIndex, unit, power);
        for (const ally of ordered(attacker.board))
          if (ally.hp > 0)
            applyAbilities(
              state,
              playerIndex,
              ally,
              "enemy_hero_attacked",
              events,
              random,
            );
        if ((unit.vampirism ?? 0) > 0 && defender.heroHp > 0) {
          const drained = heroDamage(
            state,
            events,
            playerIndex,
            unit,
            unit.vampirism!,
            "Vampirisme",
          );
          healUnit(
            state,
            events,
            playerIndex,
            unit,
            unit,
            drained,
            "Vampirisme",
          );
        }
      }
      removeDead(state, events, random);
      if (victory(state, events)) return { state, events };
    }
  }
  for (const unit of attacker.board) {
    if (!unit.temporaryAttack) continue;
    const amount = unit.temporaryAttack;
    unit.attack = Math.max(
      0,
      (unit.attack ?? unitCard(unit, attacker.cards).attack) - amount,
    );
    delete unit.temporaryAttack;
    effectEvent(
      state,
      events,
      playerIndex,
      unit,
      "Fin du bonus temporaire",
      playerIndex,
      unit,
      -amount,
    );
  }
  state.activePlayer = opponentIndex;
  state.turn++;
  state.hasSummoned = false;
  state.turnEndsAt = now + TURN_MS;
  for (const unit of ordered(defender.board)) {
    if (unit.hp <= 0) continue;
    if (unit.regeneration)
      healUnit(
        state,
        events,
        opponentIndex,
        unit,
        unit,
        unit.regeneration,
        "Régénération",
      );
    applyAbilities(state, opponentIndex, unit, "turn_start", events, random);
  }
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
      runes: player.runes?.map((r) => ({ ...r })),
      pentagrams: player.pentagrams?.map((p) => ({ ...p })),
      board: player.board.map((unit) => ({
        ...unit,
        card: {
          ...cloneCard(unitCard(unit, player.cards)),
          attack: unitAttack(unit, player),
          health: unitMaxHp(unit, player.cards),
        },
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
