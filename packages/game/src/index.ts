export * from "./cards";
export * from "./field";
import { populateField, type FieldBuildingKind } from "./field";
import summonProfiles from "./data/mighty-party-summons.json";
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
  poison?: number;
  poisoned?: number;
  extraAttacks?: number;
  formationHealth?: number;
  shield?: boolean;
  silenced?: boolean;
  immune?: boolean;
  evasion?: boolean;
  counterAttack?: boolean;
  attackCurse?: number;
  attackLimit?: number;
  formationAttack?: number;
  temporaryAttack?: number;
  /** Definitions for summoned tokens and scenery outside the collectible deck. */
  definition?: CardDefinition;
  /** Neutral scenery present at creation; cannot be voluntarily withdrawn. */
  fieldObject?: FieldBuildingKind;
}
export interface FieldBonus {
  row: number;
  depth: number;
  /** One stat per seal; optional fields preserve older saved matches. */
  health?: number;
  attack?: number;
}
export interface Rune extends FieldBonus {
  /** Applied once on arrival; remains bound to its occupant until departure. */
  activated?: boolean;
}
export type Pentagram = FieldBonus;

export function fieldBonus(mark: FieldBonus) {
  return mark.attack !== undefined
    ? { stat: "attack" as const, value: mark.attack }
    : { stat: "health" as const, value: mark.health ?? 0 };
}

export function fieldMarkName(kind: "rune" | "pentagram", mark: FieldBonus) {
  return `${kind === "rune" ? "Rune" : "Pentagramme"} de ${fieldBonus(mark).stat === "health" ? "vie" : "puissance"}`;
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
  enemy?: Pick<PlayerState, "cards" | "board">,
) {
  const card = unitCard(unit, owner.cards);
  if (unit.attackLimit !== undefined) return unit.attackLimit;
  const synergy = (unit.silenced ? [] : (card.abilities ?? []))
    .filter((a) => a.active && a.effect === "attack_per_ally")
    .reduce(
      (total, a) =>
        total +
        a.value *
          formationTargets(unit, owner, a.target, enemy, a.includeSelf).length,
      0,
    );
  return Math.max(0, (unit.attack ?? card.attack) + synergy);
}

/** Opposing front columns touch; adjacent is orthogonal, nearby includes diagonals. */
function formationTargets(
  source: Unit,
  owner: Pick<PlayerState, "cards" | "board">,
  target: CardAbility["target"],
  enemy?: Pick<PlayerState, "cards" | "board">,
  includeSelf = false,
) {
  const allies = owner.board.filter(
    (u) => (includeSelf || u !== source) && u.hp > 0,
  );
  const adjacent = (u: Unit, opposing = false, diagonal = false) => {
    const x = opposing
      ? source.depth + u.depth + 1
      : Math.abs(source.depth - u.depth);
    const y = Math.abs(source.row - u.row);
    return diagonal ? Math.max(x, y) === 1 : x + y === 1;
  };
  const card = (u: Unit) => unitCard(u, owner.cards);
  switch (target) {
    case "order_allies":
      return allies.filter((u) => card(u).faction === "order");
    case "nature_allies":
      return allies.filter((u) => card(u).faction === "nature");
    case "chaos_allies":
      return allies.filter((u) => card(u).faction === "chaos");
    case "male_allies":
      return allies.filter((u) => card(u).gender === "male");
    case "ranged_allies":
      return allies.filter((u) => getCombatType(card(u)) === "ranged");
    case "allies_with_block":
      return allies.filter((u) => (u.block ?? 0) > 0);
    case "allies_with_vampirism":
      return allies.filter((u) => (u.vampirism ?? 0) > 0);
    case "allies_with_shield":
      return allies.filter((u) => u.shield);
    case "adjacent_allies":
      return allies.filter((u) => adjacent(u));
    case "nearby_allies":
      return allies.filter((u) => adjacent(u, false, true));
    case "adjacent_heroes":
    case "nearby_heroes": {
      const diagonal = target === "nearby_heroes";
      return [
        ...allies.filter((u) => adjacent(u, false, diagonal)),
        ...(enemy?.board ?? []).filter(
          (u) => u.hp > 0 && adjacent(u, true, diagonal),
        ),
      ];
    }
    default:
      return allies;
  }
}

function refreshFormation(
  state: GameState,
  events: GameEvent[],
  random: () => number = () => 0,
) {
  for (const [player, owner] of state.players.entries()) {
    for (const unit of owner.board) {
      if (unit.hp <= 0) continue;
      const attackBonus = activeAbilities(unit, owner, "passive")
        .filter((a) => a.effect === "attack_per_ally")
        .reduce(
          (sum, a) =>
            sum +
            a.value *
              formationTargets(
                unit,
                owner,
                a.target,
                state.players[1 - player],
                a.includeSelf,
              ).length,
          0,
        );
      const gainedAttack = attackBonus - (unit.formationAttack ?? 0);
      if (attackBonus !== 0 || unit.formationAttack !== undefined)
        unit.formationAttack = attackBonus;
      if (gainedAttack > 0) punishAttack(state, events, player, unit, random);
      if (unit.hp <= 0) continue;
      const bonus = activeAbilities(unit, owner, "passive")
        .filter((a) => a.effect === "health_per_ally")
        .reduce(
          (sum, a) =>
            sum +
            a.value *
              formationTargets(unit, owner, a.target, state.players[1 - player])
                .length,
          0,
        );
      const previous = unit.formationHealth ?? 0;
      if (bonus === previous) continue;
      unit.maxHp = unitMaxHp(unit, owner.cards) + bonus - previous;
      unit.hp = Math.min(unit.maxHp, Math.max(1, unit.hp + bonus - previous));
      unit.formationHealth = bonus;
      effectEvent(
        state,
        events,
        player,
        unit,
        "Vitalité de formation",
        player,
        unit,
        bonus - previous,
      );
    }
  }
}
export type UnitPosition = Pick<Unit, "row" | "depth">;
export interface PlayerState {
  userId: string;
  name: string;
  heroHp: number;
  heroMaxHp?: number;
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
  heroMaxHp?: number;
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
  removeDead(state, events, random);
  if (victory(state, events)) return { state, events };
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
  const removedMarks = releaseFieldMarks(player, unit);
  player.discard = [];
  const events: GameEvent[] = [];
  emit(state, events, {
    type: "withdraw",
    player: playerIndex,
    cardId,
    row: unit.row,
    depth: unit.depth,
    ...removedMarks,
  });
  refreshFormation(state, events);
  return { state, events };
}

function activeAbilities(
  unit: Unit,
  owner: PlayerState,
  trigger?: CardAbility["trigger"],
) {
  return (
    unit.silenced ? [] : (unitCard(unit, owner.cards).abilities ?? [])
  ).filter((a) => a.active && (!trigger || a.trigger === trigger));
}
function initializePassives(unit: Unit, card: CardDefinition) {
  for (const a of card.abilities ?? []) {
    if (!a.active || a.trigger !== "passive") continue;
    if (a.effect === "shield") unit.shield = true;
    if (a.effect === "immunity") unit.immune = true;
    if (a.effect === "evasion") unit.evasion = true;
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
  random: () => number,
) {
  const owner = state.players[player]!;
  const healed = Math.min(
    amount,
    Math.max(0, unitMaxHp(target, owner.cards) - target.hp),
  );
  if (target.hp <= 0 || target.immune || healed <= 0) return;
  target.hp += healed;
  effectEvent(state, events, player, source, label, player, target, healed);
  react(state, player, "ally_healed", events, random, target);
}
function react(
  state: GameState,
  player: number,
  trigger: CardAbility["trigger"],
  events: GameEvent[],
  random: () => number,
  subject?: Unit,
) {
  for (const unit of [...state.players[player]!.board])
    if (
      unit.hp > 0 &&
      (unit !== subject ||
        activeAbilities(unit, state.players[player]!, trigger).some(
          (a) => a.reactToSelf,
        ))
    )
      applyAbilities(state, player, unit, trigger, events, random, subject);
}
function pick<T>(items: T[], random: () => number): T[] {
  return items.length
    ? [items[Math.min(items.length - 1, Math.floor(random() * items.length))]!]
    : [];
}
function consumeShield(
  state: GameState,
  events: GameEvent[],
  player: number,
  source: Unit,
  targetPlayer: number,
  target: Unit,
  random: () => number,
) {
  target.shield = false;
  effectEvent(
    state,
    events,
    player,
    source,
    "Bouclier mental",
    targetPlayer,
    target,
  );
  for (const p of [0, 1]) react(state, p, "shield_lost", events, random);
}
function punishAttack(
  state: GameState,
  events: GameEvent[],
  player: number,
  unit: Unit,
  random: () => number,
) {
  if (unit.attackCurse && unit.hp > 0)
    damageUnit(
      state,
      events,
      player,
      unit,
      player,
      unit,
      unit.attackCurse,
      false,
      "Malédiction",
      random,
    );
}
function targets(
  state: GameState,
  player: number,
  source: Unit,
  a: CardAbility,
  random: () => number,
  context?: Unit,
): Unit[] {
  const owner = state.players[player]!;
  const allies = owner.board.filter(
    (u) => (a.includeSelf || u !== source) && u.hp > 0,
  );
  const card = (u: Unit) => unitCard(u, owner.cards);
  switch (a.target) {
    case "self":
      return source.hp > 0 ? [source] : [];
    case "random_ally":
      return (a.count ?? 1) === 1
        ? pick(allies, random)
        : shuffle(allies, random).slice(0, a.count);
    case "random_wounded_ally":
      return pick(
        allies.filter((u) => u.hp < unitMaxHp(u, owner.cards)),
        random,
      );
    case "event_ally":
    case "event_enemy":
    case "attacker":
    case "attack_target":
      return context && context.hp > 0 ? [context] : [];
    case "random_enemy":
      return shuffle(
        state.players[1 - player]!.board.filter((u) => u.hp > 0),
        random,
      ).slice(0, a.count ?? 1);
    case "random_column_ally":
      return pick(
        allies.filter((u) => u.depth === source.depth),
        random,
      );
    case "adjacent_enemies":
      return state.players[1 - player]!.board.filter(
        (u) =>
          u.hp > 0 &&
          source.depth + u.depth + 1 + Math.abs(source.row - u.row) === 1,
      );
    case "nature_enemies":
    case "melee_enemies":
      return state.players[1 - player]!.board.filter(
        (u) =>
          u.hp > 0 &&
          (a.target === "nature_enemies"
            ? unitCard(u, state.players[1 - player]!.cards).faction === "nature"
            : getCombatType(unitCard(u, state.players[1 - player]!.cards)) ===
              "melee"),
      );
    case "all_heroes":
    case "non_chaos_heroes":
      return state.players.flatMap((p) =>
        p.board.filter(
          (u) =>
            u.hp > 0 &&
            (a.target === "all_heroes" ||
              unitCard(u, p.cards).faction !== "chaos"),
        ),
      );
    case "ranged_enemies":
      return state.players[1 - player]!.board.filter(
        (u) =>
          u.hp > 0 &&
          getCombatType(unitCard(u, state.players[1 - player]!.cards)) ===
            "ranged",
      );
    case "random_female_enemy":
      return pick(
        state.players[1 - player]!.board.filter(
          (u) =>
            u.hp > 0 &&
            unitCard(u, state.players[1 - player]!.cards).gender === "female",
        ),
        random,
      );
    case "ranged_allies":
    case "chaos_allies":
    case "male_allies":
    case "adjacent_allies":
    case "nearby_allies":
    case "adjacent_heroes":
    case "nearby_heroes":
    case "allies_with_block":
    case "allies_with_vampirism":
    case "allies_with_shield":
      return formationTargets(
        source,
        owner,
        a.target,
        state.players[1 - player],
        a.includeSelf,
      );
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
  const profile = summonProfiles.find((p) => p.kind === spec.kind);
  if (profile) {
    return {
      id: `token-${spec.kind}-${source.id}-${spec.level}`,
      baseId: profile.artId,
      artId: profile.artId,
      name: profile.name,
      title: "Renfort invoqué",
      kind: spec.kind,
      color: source.color,
      attack: spec.attack,
      health: spec.health,
      level: spec.level,
      rarity: "common",
      faction: profile.faction as CardDefinition["faction"],
      gender: profile.gender as CardDefinition["gender"],
      combatType: profile.combatType as CardDefinition["combatType"],
      abilities: profile.skills.map((s): CardAbility => {
        const value = s.values[spec.level - 1]!;
        const effect = s.effect as CardAbility["effect"];
        return {
          id: s.id,
          name:
            effect === "damage"
              ? "Dégâts magiques"
              : effect === "attack"
                ? "Puissance"
                : effect === "heal"
                  ? "Soin"
                  : "Blocage",
          description: s.descriptionFr.replace("{value}", String(value)),
          value,
          effect,
          trigger: s.trigger as CardAbility["trigger"],
          target: s.target as CardAbility["target"],
          unlockLevel: 1,
          active: true,
          ...("scaleBy" in s && s.scaleBy
            ? { scaleBy: s.scaleBy as CardAbility["target"] }
            : {}),
        };
      }),
    };
  }
  const archer = spec.kind === "archer";
  // Scarlet Warrior summons the plain archer subtype; only the support subtype
  // used by Warrioress/Soulblade has the documented Pierce skill schedule.
  const pierce =
    source.sourceHero === "Scarlet Warrior" || source.sourceHero === "Athena"
      ? undefined
      : (source.sourceHero === "Prince"
          ? [
              [2, 2],
              [3, 4],
              [4, 7],
              [5, 13],
              [6, 21],
              [7, 32],
              [8, 46],
              [9, 64],
              [10, 86],
            ]
          : [
              [5, 2],
              [8, 4],
              [11, 7],
              [14, 13],
              [17, 21],
              [20, 32],
              [23, 46],
              [26, 64],
            ]
        )
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
    ...(archer ? { gender: "female" as const } : {}),
    combatType: archer ? "ranged" : "melee",
    abilities:
      archer && pierce
        ? [
            {
              id: "pierce",
              name: "Perforation",
              description: `Inflige ${pierce[1]} dégâts aux ennemis de la colonne de la cible.`,
              unlockLevel: source.sourceHero === "Prince" ? 2 : 5,
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
  refreshFormation(state, events, random);
  react(state, player, "ally_appears", events, random, unit);
  react(state, 1 - player, "enemy_appears", events, random, unit);
  if (unitCard(unit, owner.cards).faction === "chaos") {
    for (const [p, camp] of state.players.entries())
      for (const observer of [...camp.board])
        if (observer.hp > 0)
          applyAbilities(
            state,
            p,
            observer,
            "chaos_appears",
            events,
            random,
            unit,
          );
  }
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
  if (rune && !rune.activated) {
    rune.activated = true;
    applyFieldBonus(state, events, player, unit, rune, "rune");
    events[events.length - 1]!.runes = owner.runes!.map((r) => ({ ...r }));
  }
}

function applyFieldBonus(
  state: GameState,
  events: GameEvent[],
  player: number,
  unit: Unit,
  mark: FieldBonus,
  kind: "rune" | "pentagram",
) {
  const owner = state.players[player]!;
  const bonus = fieldBonus(mark);
  if (bonus.stat === "health") {
    unit.maxHp = unitMaxHp(unit, owner.cards) + bonus.value;
    unit.hp += bonus.value;
  } else {
    unit.attack = (unit.attack ?? unitCard(unit, owner.cards).attack) + bonus.value;
  }
  effectEvent(state, events, player, unit, fieldMarkName(kind, mark), player, unit, bonus.value);
}

/** Clear the occupant's seals before death skills can summon a replacement. */
function releaseFieldMarks(owner: PlayerState, unit: UnitPosition) {
  const updates: Pick<GameEvent, "runes" | "pentagrams"> = {};
  if (owner.runes?.some((mark) => mark.row === unit.row && mark.depth === unit.depth)) {
    owner.runes = owner.runes.filter((mark) => mark.row !== unit.row || mark.depth !== unit.depth);
    updates.runes = owner.runes.map((mark) => ({ ...mark }));
  }
  if (owner.pentagrams?.some((mark) => mark.row === unit.row && mark.depth === unit.depth)) {
    owner.pentagrams = owner.pentagrams.filter((mark) => mark.row !== unit.row || mark.depth !== unit.depth);
    updates.pentagrams = owner.pentagrams.map((mark) => ({ ...mark }));
  }
  return updates;
}
function applyAbilities(
  state: GameState,
  player: number,
  source: Unit,
  trigger: CardAbility["trigger"],
  events: GameEvent[],
  random: () => number,
  context?: Unit,
) {
  const owner = state.players[player]!;
  for (const a of activeAbilities(source, owner, trigger)) {
    if (a.effect === "summon" && a.summon) {
      const placement =
        a.summon.placement ?? (a.summon.kind === "archer" ? "behind" : "front");
      let cells = Array.from({ length: ROWS * DEPTHS }, (_, i) => ({
        row: Math.floor(i / DEPTHS),
        depth: i % DEPTHS,
      }));
      if (placement === "around")
        cells = cells.filter(
          (c) =>
            Math.max(
              Math.abs(c.row - source.row),
              Math.abs(c.depth - source.depth),
            ) === 1,
        );
      else if (placement === "row")
        cells = cells.filter((c) => c.row === source.row);
      else if (placement === "random_ranged")
        cells = shuffle(
          cells.filter((c) => c.depth >= DEPTHS - FRONT_DEPTHS),
          random,
        );
      else
        cells = Array.from({ length: a.count ?? 1 }, (_, i) => ({
          row: source.row,
          depth: source.depth + (i + 1) * (placement === "behind" ? 1 : -1),
        }));
      const selectedCells =
        placement === "behind" || placement === "front"
          ? cells
          : cells.filter(
              (c) =>
                !owner.board.some(
                  (u) => u.row === c.row && u.depth === c.depth,
                ),
            );
      for (const cell of selectedCells.slice(0, a.count ?? 1)) {
        if (
          cell.depth < 0 ||
          cell.depth >= DEPTHS ||
          owner.board.some((u) => u.row === cell.row && u.depth === cell.depth)
        )
          continue;
        const definition = tokenDefinition(
          unitCard(source, owner.cards),
          a.summon,
        );
        const unit: Unit = {
          cardId: definition.id,
          ...cell,
          hp: definition.health,
          definition,
        };
        initializePassives(unit, definition);
        owner.board.push(unit);
        emit(state, events, {
          type: "summon",
          player,
          cardId: unit.cardId,
          ...cell,
          unit: snapshot(unit),
          ability: a.name,
        });
        applyAbilities(state, player, unit, "deploy", events, random);
        appeared(state, player, unit, events, random);
      }
      continue;
    }
    if (a.effect === "rune" || a.effect === "attack_rune") {
      for (let i = 0; i < (a.count ?? 1); i++) {
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
          owner.runes = [
            ...(owner.runes ?? []),
            {
              ...cell,
              health: a.effect === "rune" ? a.value : 0,
              ...(a.effect === "attack_rune" ? { attack: a.value } : {}),
            },
          ];
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
      }
      continue;
    }
    const value =
      a.value *
      (a.scaleBy
        ? formationTargets(
            source,
            owner,
            a.scaleBy,
            state.players[1 - player],
            a.scaleIncludeSelf,
          ).length
        : 1);
    if (a.target === "ally_hero" && a.effect === "health") {
      if (owner.heroHp <= 0) continue;
      owner.heroMaxHp = (owner.heroMaxHp ?? HERO_HP) + value;
      owner.heroHp += value;
      effectEvent(
        state,
        events,
        player,
        source,
        a.name,
        player,
        undefined,
        value,
      );
      events[events.length - 1]!.heroMaxHp = owner.heroMaxHp;
      continue;
    }
    if (a.effect === "hero_damage_from_health") {
      const ally = targets(state, player, source, a, random)[0];
      if (ally)
        heroDamage(
          state,
          events,
          player,
          source,
          Math.floor((ally.hp * value) / 100),
          a.name,
        );
      continue;
    }
    if (a.target === "enemy_hero" && a.effect === "damage") {
      heroDamage(state, events, player, source, value, a.name);
      continue;
    }
    if (a.target === "ally_hero" && a.effect === "heal") {
      const healed = Math.max(
        0,
        Math.min(value, (owner.heroMaxHp ?? HERO_HP) - owner.heroHp),
      );
      if (healed && owner.heroHp > 0) {
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
    for (const target of targets(state, player, source, a, random, context)) {
      const targetPlayer = state.players[1 - player]!.board.includes(target)
        ? 1 - player
        : player;
      const targetOwner = state.players[targetPlayer]!;
      if (target.immune) {
        effectEvent(
          state,
          events,
          player,
          source,
          "Immunité",
          targetPlayer,
          target,
        );
        continue;
      }
      if (
        targetPlayer !== player &&
        target.shield &&
        [
          "silence",
          "set_attack",
          "attack_curse",
          "poison_enemy",
          "steal_attack",
        ].includes(a.effect)
      ) {
        consumeShield(
          state,
          events,
          player,
          source,
          targetPlayer,
          target,
          random,
        );
        continue;
      }
      if (a.effect === "cleanse") {
        delete target.poisoned;
        delete target.attackCurse;
        delete target.attackLimit;
        target.attack = Math.max(
          target.attack ?? unitCard(target, targetOwner.cards).attack,
          unitCard(target, targetOwner.cards).attack,
        );
      } else if (a.effect === "silence") {
        target.silenced = true;
        target.attack = Math.min(
          target.attack ?? unitCard(target, targetOwner.cards).attack,
          unitCard(target, targetOwner.cards).attack,
        );
        target.maxHp = Math.min(
          unitMaxHp(target, targetOwner.cards),
          unitCard(target, targetOwner.cards).health,
        );
        target.hp = Math.min(target.hp, target.maxHp);
        if (target.shield)
          consumeShield(
            state,
            events,
            player,
            source,
            targetPlayer,
            target,
            random,
          );
        for (const key of [
          "block",
          "spikes",
          "vampirism",
          "regeneration",
          "poison",
          "extraAttacks",
          "counterAttack",
          "evasion",
          "temporaryAttack",
          "formationHealth",
          "formationAttack",
        ] as const)
          delete target[key];
      } else if (a.effect === "set_attack") target.attackLimit = value;
      else if (a.effect === "attack_curse")
        target.attackCurse = Math.max(target.attackCurse ?? 0, value);
      else if (a.effect === "counter_attack") target.counterAttack = true;
      else if (a.effect === "poison_enemy")
        target.poisoned = (target.poisoned ?? 0) + value;
      else if (a.effect === "drain") {
        const drained = damageUnit(
          state,
          events,
          player,
          source,
          targetPlayer,
          target,
          value,
          false,
          a.name,
          random,
        );
        healUnit(
          state,
          events,
          player,
          source,
          source,
          drained,
          a.name,
          random,
        );
        continue;
      } else if (
        ![
          "damage",
          "heal",
          "heal_full",
          "steal_attack",
          "shield",
          "extra_attack",
          "attack",
          "health",
          "block",
          "spikes",
          "vampirism",
          "regeneration",
          "poison",
        ].includes(a.effect)
      )
        continue;
      else {
        if (a.effect === "damage") {
          damageUnit(
            state,
            events,
            player,
            source,
            targetPlayer,
            target,
            value,
            false,
            a.name,
            random,
          );
          continue;
        }
        if (a.effect === "heal" || a.effect === "heal_full") {
          healUnit(
            state,
            events,
            targetPlayer,
            source,
            target,
            a.effect === "heal_full"
              ? unitMaxHp(target, targetOwner.cards)
              : value,
            a.name,
            random,
          );
          continue;
        }
        if (a.effect === "steal_attack") {
          const stolen = Math.min(
            value,
            unitAttack(target, targetOwner, owner),
          );
          target.attack =
            (target.attack ?? unitCard(target, targetOwner.cards).attack) -
            stolen;
          source.attack =
            (source.attack ?? unitCard(source, owner.cards).attack) + stolen;
          effectEvent(
            state,
            events,
            player,
            source,
            a.name,
            targetPlayer,
            target,
            -stolen,
          );
          effectEvent(
            state,
            events,
            player,
            source,
            a.name,
            player,
            source,
            stolen,
          );
          if (stolen > 0) punishAttack(state, events, player, source, random);
          continue;
        }
        if (a.effect === "shield") {
          target.shield = true;
        } else if (a.effect === "extra_attack") {
          target.extraAttacks = (target.extraAttacks ?? 0) + value;
        } else if (a.effect === "attack") {
          target.attack = Math.max(
            0,
            (target.attack ?? unitCard(target, targetOwner.cards).attack) +
              value,
          );
          if (a.temporary)
            target.temporaryAttack = (target.temporaryAttack ?? 0) + value;
        } else if (a.effect === "health") {
          target.maxHp = unitMaxHp(target, targetOwner.cards) + value;
          target.hp += value;
        } else if (
          a.effect === "block" ||
          a.effect === "spikes" ||
          a.effect === "vampirism" ||
          a.effect === "regeneration" ||
          a.effect === "poison"
        ) {
          target[a.effect] = (target[a.effect] ?? 0) + value;
        } else continue;
      }
      effectEvent(
        state,
        events,
        player,
        source,
        a.name,
        targetPlayer,
        target,
        value,
      );
      if (a.effect === "attack" && value > 0)
        punishAttack(state, events, targetPlayer, target, random);
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
  random: () => number = () => 0,
) {
  if (target.hp <= 0) return 0;
  const avoided =
    physical &&
    target.evasion === true &&
    getCombatType(unitCard(source, state.players[player]!.cards)) === "ranged";
  const immune = !physical && target.immune === true;
  const shielded = !avoided && !immune && target.shield === true;
  if (shielded) target.shield = false;
  const damage =
    shielded || avoided || immune
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
      ...(shielded || avoided || label
        ? {
            ability: avoided ? "Esquive" : shielded ? "Bouclier mental" : label,
          }
        : {}),
    });
  } else
    effectEvent(
      state,
      events,
      player,
      source,
      immune ? "Immunité" : shielded ? "Bouclier mental" : label!,
      targetPlayer,
      target,
      -damage,
    );
  if (shielded)
    for (const p of [0, 1]) react(state, p, "shield_lost", events, random);
  if (damage > 0 && target.hp <= 0 && targetPlayer !== player && source.hp > 0)
    applyAbilities(state, player, source, "kill", events, random, target);
  if (physical && !avoided) {
    if (!shielded && (target.block ?? 0) > 0 && amount > 0)
      react(state, targetPlayer, "ally_block", events, random, target);
    applyAbilities(
      state,
      targetPlayer,
      target,
      "attacked",
      events,
      random,
      source,
    );
    react(state, targetPlayer, "ally_attacked", events, random, source);
    if (
      target.hp <= 0 &&
      activeAbilities(
        target,
        state.players[targetPlayer]!,
        "ally_attacked",
      ).some((a) => a.reactToSelf)
    )
      applyAbilities(
        state,
        targetPlayer,
        target,
        "ally_attacked",
        events,
        random,
        source,
      );
  }
  return damage;
}
/** Counterattacks complete one strike but never launch a reciprocal counterattack. */
function counterStrike(
  state: GameState,
  events: GameEvent[],
  player: number,
  victim: Unit,
  unit: Unit,
  random: () => number,
) {
  if (!unit.counterAttack || unit.hp <= 0 || victim.hp <= 0) return;
  const p = 1 - player,
    owner = state.players[p]!,
    defender = state.players[player]!;
  applyAbilities(state, p, unit, "before_attack", events, random);
  const power = unitAttack(unit, owner, defender);
  if (power <= 0 || unit.hp <= 0) return;
  react(
    state,
    player,
    getCombatType(unitCard(unit, owner.cards)) === "melee"
      ? "before_enemy_melee_attack"
      : "before_enemy_ranged_attack",
    events,
    random,
  );
  damageUnit(
    state,
    events,
    p,
    unit,
    player,
    victim,
    power,
    true,
    "Contre-attaque",
    random,
  );
  for (const a of activeAbilities(unit, owner, "passive").filter(
    (a) => a.effect === "pierce",
  ))
    for (const other of defender.board.filter(
      (u) => u.hp > 0 && u.depth === victim.depth,
    ))
      damageUnit(
        state,
        events,
        p,
        unit,
        player,
        other,
        a.value,
        false,
        a.name,
        random,
      );
  if ((unit.vampirism ?? 0) > 0 && unit.hp > 0 && victim.hp > 0) {
    const drained = damageUnit(
      state,
      events,
      p,
      unit,
      player,
      victim,
      unit.vampirism!,
      false,
      "Vampirisme",
      random,
    );
    healUnit(state, events, p, unit, unit, drained, "Vampirisme", random);
    if (drained > 0) react(state, p, "ally_vampirism", events, random, unit);
  }
  if (unit.poison && unit.hp > 0 && victim.hp > 0 && !victim.immune) {
    if (victim.shield)
      consumeShield(state, events, p, unit, player, victim, random);
    else {
      victim.poisoned = (victim.poisoned ?? 0) + unit.poison;
      effectEvent(
        state,
        events,
        p,
        unit,
        "Empoisonnement",
        player,
        victim,
        unit.poison,
      );
    }
  }
  if (victim.spikes && unit.hp > 0) {
    damageUnit(
      state,
      events,
      player,
      victim,
      p,
      unit,
      victim.spikes,
      false,
      "Épines",
      random,
    );
    react(state, player, "ally_spikes", events, random, victim);
  }
  applyAbilities(state, p, unit, "attack", events, random, victim);
}

function removeDead(
  state: GameState,
  events: GameEvent[],
  random: () => number,
) {
  do {
    for (const [player, owner] of state.players.entries()) {
      for (const dead of [...owner.board].filter((u) => u.hp <= 0)) {
        owner.board = owner.board.filter((u) => u !== dead);
        const removedMarks = releaseFieldMarks(owner, dead);
        emit(state, events, {
          type: "death",
          player,
          cardId: dead.cardId,
          row: dead.row,
          depth: dead.depth,
          ...removedMarks,
        });
        applyAbilities(state, player, dead, "death", events, random);
        react(state, player, "ally_death", events, random, dead);
        react(state, 1 - player, "enemy_death", events, random, dead);
        for (const p of [0, 1])
          react(state, p, "any_death", events, random, dead);
        applyAbilities(state, player, dead, "any_death", events, random, dead);
      }
    }
    refreshFormation(state, events, random);
  } while (state.players.some((p) => p.board.some((u) => u.hp <= 0)));
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
      (unit.extraAttacks ?? 0) +
      passives
        .filter((a) => a.effect === "extra_attack")
        .reduce((n, a) => n + a.value, 0);
    for (
      let hit = 0;
      hit < attacks && unit.hp > 0 && attacker.board.includes(unit);
      hit++
    ) {
      if (unitAttack(unit, attacker, defender) <= 0) break;
      applyAbilities(state, playerIndex, unit, "before_attack", events, random);
      if (unit.hp <= 0) break;
      const power = unitAttack(unit, attacker, defender);
      if (power <= 0) break;
      if (getCombatType(card) === "ranged")
        react(
          state,
          opponentIndex,
          "before_enemy_ranged_attack",
          events,
          random,
        );
      else
        react(
          state,
          opponentIndex,
          "before_enemy_melee_attack",
          events,
          random,
        );
      const target = ordered(defender.board).find(
        (other) => other.row === unit.row && other.hp > 0,
      );
      if (target) {
        const evaded = target.evasion && getCombatType(card) === "ranged";
        damageUnit(
          state,
          events,
          playerIndex,
          unit,
          opponentIndex,
          target,
          power,
          true,
          undefined,
          random,
        );
        if (!evaded) {
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
                random,
              );
          }
          if ((unit.vampirism ?? 0) > 0 && unit.hp > 0 && target.hp > 0) {
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
              random,
            );
            healUnit(
              state,
              events,
              playerIndex,
              unit,
              unit,
              drained,
              "Vampirisme",
              random,
            );
            if (drained > 0)
              react(state, playerIndex, "ally_vampirism", events, random, unit);
          }
          if ((unit.poison ?? 0) > 0 && target.hp > 0) {
            if (target.immune) {
              effectEvent(
                state,
                events,
                playerIndex,
                unit,
                "Immunité",
                opponentIndex,
                target,
              );
            } else if (target.shield)
              consumeShield(
                state,
                events,
                playerIndex,
                unit,
                opponentIndex,
                target,
                random,
              );
            else {
              target.poisoned = (target.poisoned ?? 0) + unit.poison!;
              effectEvent(
                state,
                events,
                playerIndex,
                unit,
                "Empoisonnement",
                opponentIndex,
                target,
                unit.poison!,
              );
            }
          }
          // Attacked effects resolve before deaths, including lethal counter-damage.
          if ((target.spikes ?? 0) > 0 && unit.hp > 0) {
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
              random,
            );
            react(state, opponentIndex, "ally_spikes", events, random, target);
          }
          applyAbilities(
            state,
            playerIndex,
            unit,
            "attack",
            events,
            random,
            target,
          );
          counterStrike(state, events, playerIndex, unit, target, random);
        }
      } else {
        heroDamage(state, events, playerIndex, unit, power);
        react(state, opponentIndex, "ally_hero_attacked", events, random);
        applyAbilities(state, playerIndex, unit, "hero_attack", events, random);
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
            random,
          );
          if (drained > 0)
            react(state, playerIndex, "ally_vampirism", events, random, unit);
        }
        applyAbilities(state, playerIndex, unit, "attack", events, random);
      }
      removeDead(state, events, random);
      if (victory(state, events)) return { state, events };
    }
  }
  for (const unit of ordered(attacker.board)) {
    if (unit.hp > 0)
      applyAbilities(state, playerIndex, unit, "turn_end", events, random);
    removeDead(state, events, random);
    if (victory(state, events)) return { state, events };
  }
  for (const unit of attacker.board) {
    if (unit.attackLimit !== undefined) {
      delete unit.attackLimit;
      effectEvent(
        state,
        events,
        playerIndex,
        unit,
        "Fin de l’entrave",
        playerIndex,
        unit,
      );
    }
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
    if (unit.poisoned) {
      damageUnit(
        state,
        events,
        opponentIndex,
        unit,
        opponentIndex,
        unit,
        unit.poisoned,
        false,
        "Poison",
        random,
      );
      react(state, playerIndex, "enemy_poison", events, random, unit);
      removeDead(state, events, random);
      if (victory(state, events)) return { state, events };
      if (unit.hp <= 0) continue;
    }
    if (unit.regeneration) {
      const previousHp = unit.hp;
      healUnit(
        state,
        events,
        opponentIndex,
        unit,
        unit,
        unit.regeneration,
        "Régénération",
        random,
      );
      if (unit.hp > previousHp)
        react(state, opponentIndex, "ally_regeneration", events, random, unit);
    }
    applyAbilities(state, opponentIndex, unit, "turn_start", events, random);
    removeDead(state, events, random);
    if (victory(state, events)) return { state, events };
  }
  removeDead(state, events, random);
  if (victory(state, events)) return { state, events };
  // Only the owner's start of turn triggers persistent seals, never deployment.
  for (const unit of ordered(defender.board)) {
    if (unit.hp <= 0) continue;
    const pentagram = defender.pentagrams?.find(
      (mark) => mark.row === unit.row && mark.depth === unit.depth,
    );
    if (pentagram)
      applyFieldBonus(state, events, opponentIndex, unit, pentagram, "pentagram");
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
      ...(player.heroMaxHp ? { heroMaxHp: player.heroMaxHp } : {}),
      // Deck composition is public; hand contents and draw order stay private.
      deck: player.cards.map((card) => ({ ...card })),
      runes: player.runes?.map((r) => ({ ...r })),
      pentagrams: player.pentagrams?.map((p) => ({ ...p })),
      board: player.board.map((unit) => ({
        ...unit,
        card: {
          ...cloneCard(unitCard(unit, player.cards)),
          ...(unit.silenced ? { abilities: [] } : {}),
          attack: unitAttack(unit, player, state.players[1 - index]),
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
