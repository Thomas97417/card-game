import { describe, expect, it } from "vitest";
import {
  DEFAULT_DECK,
  FIELD_BUILDINGS,
  createFieldBuilding,
  createGame,
  endTurn,
  isMeleeBlocked,
  legalPlacements,
  playerView,
  summon,
  unitAttack,
  validateDeck,
  variantCard,
  withdraw,
  type PlayerState,
} from "./index";
import { chooseComputerMove } from "./practice";

const random = () => 0.25;
function fresh(field = false) {
  const cards = validateDeck(DEFAULT_DECK);
  const state = createGame([
    { userId: "a", name: "A", cards },
    { userId: "b", name: "B", cards },
  ], 0, random, { field });
  state.activePlayer = 0;
  return state;
}
function seeded(seed: number) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function layout(player: PlayerState) {
  return Array.from({ length: 12 }, (_, index) => {
    const row = Math.floor(index / 3);
    const depth = index % 3;
    return player.board.find((unit) => unit.row === row && unit.depth === depth)?.fieldObject
      ?? (player.runes?.some((mark) => mark.row === row && mark.depth === depth) ? "rune" : null)
      ?? (player.pentagrams?.some((mark) => mark.row === row && mark.depth === depth) ? "pentagram" : null);
  });
}

describe("terrain initial", () => {
  it("starts new matches with independent asymmetric fields and unchanged decks", () => {
    const cards = validateDeck(DEFAULT_DECK);
    const state = createGame([
      { userId: "a", name: "A", cards },
      { userId: "b", name: "B", cards },
    ], 0, random);
    const [a, b] = state.players;
    expect(layout(a!)).not.toEqual(layout(b!));
    for (const owner of state.players) {
      expect(owner.cards.map((card) => card.id)).toEqual(DEFAULT_DECK);
      expect(owner.hand).toHaveLength(4);
      expect(legalPlacements(cards[0]!, owner.board).length).toBeGreaterThanOrEqual(5);
      expect(legalPlacements(cards[3]!, owner.board).length).toBeGreaterThanOrEqual(5);
    }
  });

  it("keeps each side's scenery, marks and catalogue definitions independent", () => {
    const cards = validateDeck(DEFAULT_DECK);
    const state = createGame([
      { userId: "a", name: "A", cards },
      { userId: "b", name: "B", cards },
    ], 0, () => 0.999);
    const [a, b] = state.players;
    const before = structuredClone(b);
    a!.board[0]!.definition!.health = 99;
    a!.runes![0]!.health = 99;
    a!.pentagrams![0]!.attack = 99;
    expect(b).toEqual(before);
    expect(Object.values(FIELD_BUILDINGS).every((card) => card.health < 99)).toBe(true);
  });

  it("varies all three quantities and positions within balance limits across 500 seeds", () => {
    const kinds = new Set<string>();
    const layouts = new Set<string>();
    const quantities = [new Set<number>(), new Set<number>(), new Set<number>()];
    const advantages = new Set<number>();
    const cards = validateDeck(DEFAULT_DECK);
    for (let seed = 1; seed <= 500; seed++) {
      const inputs = [{ userId: "a", name: "A", cards }, { userId: "b", name: "B", cards }];
      const state = createGame(inputs, 0, seeded(seed));
      expect(state).toEqual(createGame(inputs, 0, seeded(seed)));
      const counts = state.players.map((owner) => [owner.board.length, owner.runes!.length, owner.pentagrams!.length]);
      for (let kind = 0; kind < 3; kind++) {
        expect(Math.abs(counts[0]![kind]! - counts[1]![kind]!)).toBeLessThanOrEqual(1);
      }
      const bonusDifference = counts[0]![1]! + counts[0]![2]! - counts[1]![1]! - counts[1]![2]!;
      expect(Math.abs(bonusDifference)).toBeLessThanOrEqual(1);
      advantages.add(Math.sign(bonusDifference));
      expect(layout(state.players[0]!)).not.toEqual(layout(state.players[1]!));
      for (const [index, owner] of state.players.entries()) {
        const cells = [...owner.board, ...owner.runes!, ...owner.pentagrams!];
        expect(cells.length).toBeGreaterThanOrEqual(2);
        expect(cells.length).toBeLessThanOrEqual(6);
        expect(new Set(cells.map((cell) => `${cell.row}:${cell.depth}`)).size).toBe(cells.length);
        expect(cells.every((cell) => cell.row >= 0 && cell.row < 4 && cell.depth >= 0 && cell.depth < 3)).toBe(true);
        expect(owner.board.length).toBeLessThanOrEqual(3);
        expect(owner.runes!.length).toBeLessThanOrEqual(2);
        expect(owner.pentagrams!.length).toBeLessThanOrEqual(2);
        expect(new Set(owner.board.map((unit) => unit.row)).size).toBe(owner.board.length);
        expect(new Set(owner.board.map((unit) => unit.fieldObject)).size).toBe(owner.board.length);
        owner.board.forEach((unit) => kinds.add(unit.fieldObject!));
        counts[index]!.forEach((count, kind) => quantities[kind]!.add(count));
        layouts.add(JSON.stringify(layout(owner)));
        for (const card of cards) expect(legalPlacements(card, owner.board).length).toBeGreaterThanOrEqual(5);
      }
    }
    expect(kinds.size).toBe(3);
    expect(layouts.size).toBeGreaterThan(100);
    expect([...quantities[0]!].sort()).toEqual([0, 1, 2, 3]);
    expect([...quantities[1]!].sort()).toEqual([0, 1, 2]);
    expect([...quantities[2]!].sort()).toEqual([0, 1, 2]);
    expect(advantages).toEqual(new Set([-1, 0, 1]));
  });

  it.each([0, 0.25, 0.5, 0.999])("always breaks exact mirrors with a constant random source of %s", (value) => {
    const cards = validateDeck(DEFAULT_DECK);
    const state = createGame([
      { userId: "a", name: "A", cards },
      { userId: "b", name: "B", cards },
    ], 0, () => value);
    expect(layout(state.players[0]!)).not.toEqual(layout(state.players[1]!));
  });

  it("keeps old empty snapshots playable and never populates them during a transition", () => {
    const state = fresh();
    expect(state.players.every((owner) => owner.board.length === 0 && !owner.runes && !owner.pentagrams)).toBe(true);
    const next = endTurn(state, 0, 1, 1, random).state;
    expect(next.players.every((owner) => owner.board.length === 0 && !owner.pentagrams)).toBe(true);
  });

  it("publishes mark positions without sharing their mutable state", () => {
    const state = fresh(true);
    const view = playerView(state, "a");
    view.players[0]!.pentagrams![0]!.attack = 88;
    expect(state.players[0]!.pentagrams![0]!.attack).toBe(2);
    expect(view.players[1]!.hand).toEqual([]);
    expect(view.players[0]!.board.every((unit) => unit.card.kind === "field-building")).toBe(true);
  });
});

describe("bâtiments neutres", () => {
  it("rejects placement on an obstacle and rejects voluntary withdrawal on the server", () => {
    const state = fresh();
    const obstacle = createFieldBuilding("spikes", 0, 0);
    state.players[0]!.board.push(obstacle);
    const before = structuredClone(state);
    expect(() => summon(state, 0, "guardian:common", 0, 0, 1, 1, random)).toThrow("occupée");
    expect(() => withdraw(state, 0, obstacle.cardId, 1, 1, obstacle)).toThrow("bâtiment neutre");
    expect(state).toEqual(before);
  });

  it("blocks melee behind scenery while letting ranged creatures attack", () => {
    const state = fresh();
    const owner = state.players[0]!;
    const obstacle = createFieldBuilding("mossy-rock", 0, 0);
    const melee = { cardId: "guardian:common", row: 0, depth: 1, hp: 7 };
    owner.board.push(obstacle, melee, { cardId: "wisp:common", row: 0, depth: 2, hp: 9 });
    expect(isMeleeBlocked(melee, owner.board, owner.cards)).toBe(true);
    const result = endTurn(state, 0, 1, 1, random);
    expect(result.events.filter((event) => event.type === "attack").map((event) => event.cardId)).toEqual(["wisp:common"]);
  });

  it("destroys scenery, resolves spikes on a killing blow and frees the cell", () => {
    const state = fresh();
    state.players[0]!.board.push({ cardId: "guardian:common", row: 0, depth: 0, hp: 7, attack: 12 });
    state.players[1]!.board.push(createFieldBuilding("spikes", 0, 0));
    const before = structuredClone(state);
    const result = endTurn(state, 0, 1, 1, random);
    expect(result.state.players[1]!.board).toEqual([]);
    expect(result.state.players[0]!.board[0]!.hp).toBe(6);
    expect(result.events.findIndex((event) => event.ability === "Épines")).toBeLessThan(result.events.findIndex((event) => event.type === "death"));
    expect(legalPlacements(state.players[1]!.cards[0]!, result.state.players[1]!.board)).toContainEqual({ row: 0, depth: 0 });
    expect(state).toEqual(before);
  });

  it("regenerates a damaged dark tree at its side's turn without attacking", () => {
    const state = fresh();
    const tree = createFieldBuilding("dark-tree", 0, 1);
    tree.hp = 3;
    state.players[1]!.board.push(tree);
    const result = endTurn(state, 0, 1, 1, random);
    expect(result.state.players[1]!.board[0]!.hp).toBe(4);
    expect(result.events.some((event) => event.ability === "Régénération")).toBe(true);
    const attack = endTurn(result.state, 1, 2, 2, random);
    expect(attack.events.some((event) => event.type === "attack")).toBe(false);
  });
});

describe("sceaux du terrain", () => {
  it("keeps ability-created runes off existing marks and neutral buildings", () => {
    const state = fresh();
    const owner = state.players[0]!;
    const caster = variantCard("enchantress", "common", 1);
    owner.cards[0] = caster;
    owner.hand[0] = caster.id;
    owner.pentagrams = [{ row: 0, depth: 0, attack: 2 }];
    owner.runes = [{ row: 0, depth: 1, health: 3 }];
    owner.board.push(createFieldBuilding("mossy-rock", 1, 0));
    const result = summon(state, 0, caster.id, 0, 2, 1, 1, () => 0);
    expect(result.state.players[0]!.runes).toEqual([
      { row: 0, depth: 1, health: 3 },
      { row: 1, depth: 1, health: 2 },
    ]);
    expect(result.state.players[0]!.pentagrams).toEqual(owner.pentagrams);
    expect(owner.runes).toHaveLength(1);
  });

  it("consumes a life rune once, increases current and maximum HP and persists its event", () => {
    const state = fresh();
    state.players[0]!.runes = [{ row: 0, depth: 0, health: 3 }];
    const health = state.players[0]!.cards[0]!.health;
    const result = summon(state, 0, "guardian:common", 0, 0, 1, 1, random);
    expect(result.state.players[0]!.board[0]).toMatchObject({ hp: health + 3, maxHp: health + 3 });
    expect(result.state.players[0]!.runes).toEqual([]);
    expect(result.events.find((event) => event.ability === "Rune de vie")).toMatchObject({ runes: [], amount: 3 });
    expect(state.players[0]!.runes).toHaveLength(1);
  });

  it("applies a pentagram before the first attack and preserves the bonus across turns", () => {
    const state = fresh();
    const base = state.players[0]!.cards[0]!.attack;
    state.players[0]!.pentagrams = [{ row: 0, depth: 0, attack: 2 }];
    const result = summon(state, 0, "guardian:common", 0, 0, 1, 1, random);
    const effect = result.events.find((event) => event.ability === "Pentagramme de puissance")!;
    expect(effect).toMatchObject({ pentagrams: [], amount: 2, unit: { attack: base + 2 } });
    expect(effect.seq).toBeLessThan(result.events.find((event) => event.type === "attack")!.seq);
    expect(result.state.players[1]!.heroHp).toBe(30 - base - 2);
    const next = endTurn(result.state, 1, 2, 2, random).state;
    expect(unitAttack(next.players[0]!.board[0]!, next.players[0]!)).toBe(base + 2);
    expect(next.players[0]!.pentagrams).toEqual([]);
    expect(state.players[0]!.pentagrams).toHaveLength(1);
    const removed = withdraw(next, 0, "guardian:common", 3, 3).state;
    const again = summon(removed, 0, "guardian:common", 0, 0, 3, 3, random);
    expect(unitAttack(again.state.players[0]!.board[0]!, again.state.players[0]!)).toBe(base);
  });

  it("also grants a pentagram to a summoned reinforcement without altering its deck definition", () => {
    const state = fresh();
    const witch = variantCard("witch", "common", 1);
    state.players[0]!.cards[0] = witch;
    state.players[0]!.hand[0] = witch.id;
    state.players[0]!.pentagrams = [{ row: 0, depth: 1, attack: 2 }];
    const result = summon(state, 0, witch.id, 0, 2, 1, 1, random);
    const token = result.state.players[0]!.board.find((unit) => unit.definition)!;
    expect(token.attack).toBe(token.definition!.attack + 2);
    expect(result.state.players[0]!.pentagrams).toEqual([]);
    expect(result.state.players[0]!.cards).toHaveLength(4);
    expect(result.state.players[0]!.cards.some((card) => card.id === token.cardId)).toBe(false);
  });

  it("lets the computer evaluate marks and neutral objects without mutating the match", () => {
    const state = fresh(true);
    const before = structuredClone(state);
    const move = chooseComputerMove(playerView(state, "a"), random)!;
    expect(move).toBeTruthy();
    const owner = state.players[0]!;
    expect(legalPlacements(owner.cards.find((card) => card.id === move.cardId)!, owner.board)).toContainEqual({ row: move.row, depth: move.depth });
    expect(state).toEqual(before);
  });
});
