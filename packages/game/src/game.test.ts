import { describe, expect, it } from "vitest";
import {
  CATALOG,
  DEFAULT_DECK,
  DEPTHS,
  ROWS,
  createGame,
  endTurn,
  getCombatType,
  isDeploymentDepth,
  isMeleeBlocked,
  legalPlacements,
  HERO_HP,
  playerView,
  summon,
  withdraw,
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
  it("requires exactly eight known unique cards", () => {
    expect(validateDeck(DEFAULT_DECK)).toHaveLength(8);
    expect(() =>
      validateDeck(CATALOG.slice(0, 9).map((card) => card.id)),
    ).toThrow("8 cartes");
    expect(() => validateDeck(DEFAULT_DECK.slice(1))).toThrow("8 cartes");
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
  it("defines both combat types and infers them for legacy snapshots", () => {
    expect(CATALOG.filter((card) => card.combatType === "melee")).toHaveLength(6);
    expect(CATALOG.filter((card) => card.combatType === "ranged")).toHaveLength(6);
    for (const { combatType, ...legacy } of CATALOG)
      expect(getCombatType(legacy)).toBe(combatType);
  });
});
describe("début de partie et confidentialité", () => {
  it("starts with two 30 HP heroes, four cards and a server-selected first player", () => {
    const state = initial();
    expect(state.activePlayer).toBe(0);
    expect(state.turnEndsAt).toBe(TURN_MS);
    for (const player of state.players) {
      expect(player.heroHp).toBe(HERO_HP);
      expect(player.hand).toHaveLength(4);
      expect(player.drawPile).toHaveLength(4);
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
    expect(view.players[0]!.hand).toHaveLength(4);
    expect(view.players[1]!.hand).toEqual([]);
    expect(view.players[1]!.handCount).toBe(4);
    expect(view.players[1]).not.toHaveProperty("cards");
    expect(view.players[1]).not.toHaveProperty("drawPile");
    expect(view.players[1]).not.toHaveProperty("userId");
  });
});
describe("invocation", () => {
  it("keeps twelve cells per camp and shares the middle column without stacking units", () => {
    expect(ROWS).toBe(4);
    expect(DEPTHS).toBe(3);
    const melee = CATALOG.find((card) => card.id === "guardian")!;
    const ranged = CATALOG.find((card) => card.id === "owl")!;
    expect(legalPlacements(melee, [])).toHaveLength(8);
    expect(legalPlacements(ranged, [])).toHaveLength(8);
    const state = initial();
    state.players[0]!.hand = ["owl"];
    unit(state, 0, "guardian", 1, 1);
    expect(() => summon(state, 0, "owl", 1, 1, 1, 1, random)).toThrow("occupée");
    expect(legalPlacements(ranged, state.players[0]!.board)).not.toContainEqual({ row: 1, depth: 1 });
    expect(summon(state, 0, "owl", 2, 1, 1, 1, random).state.players[0]!.board)
      .toContainEqual({ cardId: "owl", row: 2, depth: 1, hp: ranged.health });
  });
  it("summons, attacks and switches players atomically without mutating input", () => {
    const state = initial();
    const id = state.players[0]!.hand[0]!;
    const card = state.players[0]!.cards.find((card) => card.id === id)!;
    const depth = getCombatType(card) === "melee" ? 1 : 2;
    const result = summon(state, 0, id, 2, depth, 1, 10, random);
    expect(state.players[0]!.board).toEqual([]);
    expect(result.state.players[0]!.board[0]).toMatchObject({
      cardId: id,
      row: 2,
      depth,
    });
    expect(result.state.players[0]!.hand).toHaveLength(3);
    expect(result.events.map((event) => event.type)).toEqual(["summon", "attack", "turn"]);
    expect(result.events.map((event) => event.seq)).toEqual([1, 2, 3]);
    expect(result.state.activePlayer).toBe(1);
    expect(result.state.turn).toBe(2);
    expect(result.state.turnEndsAt).toBe(10 + TURN_MS);
    expect(result.state.players[1]!.heroHp).toBe(HERO_HP - card.attack);
    expect(state.players[1]!.heroHp).toBe(HERO_HP);
    expect(() =>
      summon(result.state, 0, result.state.players[0]!.hand[0]!, 0, 0, 1, 11, random),
    ).toThrow("changé");
    expect(() =>
      summon(result.state, 0, result.state.players[0]!.hand[0]!, 0, 0, 2, 11, random),
    ).toThrow("tour");
  });
  it("rejects wrong turns, stale requests, missing cards, occupied cells and bad coordinates", () => {
    const state = initial();
    const id = state.players[0]!.hand[0]!;
    expect(() => summon(state, 1, id, 0, 0, 1, 1, random)).toThrow("tour");
    expect(() => summon(state, 0, id, 0, 0, 0, 1, random)).toThrow("changé");
    expect(() => summon(state, 0, "not-in-hand", 0, 0, 1, 1, random)).toThrow("main");
    for (const [row, depth] of [
      [4, 0],
      [0, DEPTHS],
      [-1, 0],
      [0.5, 0],
      [0, -1],
    ])
      expect(() => summon(state, 0, id, row!, depth!, 1, 1, random)).toThrow("case");
    unit(state, 0, state.players[0]!.hand[1]!, 0, 0);
    expect(() => summon(state, 0, id, 0, 0, 1, 1, random)).toThrow("occupée");
  });
  it("rejects summons at the deadline", () => {
    const state = initial();
    expect(() =>
      summon(state, 0, state.players[0]!.hand[0]!, 0, 0, 1, TURN_MS, random),
    ).toThrow("écoulé");
  });
  it.each([0, 1])("enforces every card's deployment zone for player %i", (playerIndex) => {
    for (const card of CATALOG) {
      for (let depth = 0; depth < DEPTHS; depth++) {
        const state = initial();
        state.activePlayer = playerIndex;
        state.players[playerIndex]!.cards = CATALOG.map((entry) => ({ ...entry }));
        state.players[playerIndex]!.hand = [card.id];
        const play = () => summon(state, playerIndex, card.id, 0, depth, 1, 1, random);
        if (card.combatType === "melee" ? depth < 2 : depth >= 1)
          expect(play().state.players[playerIndex]!.board[0]!.depth).toBe(depth);
        else {
          expect(play).toThrow("colonnes");
          expect(state.players[playerIndex]!.hand).toEqual([card.id]);
          expect(state.players[playerIndex]!.board).toEqual([]);
        }
      }
    }
  });
  it("can win immediately without switching to the defeated player", () => {
    const state = initial();
    const id = state.players[0]!.hand[0]!;
    const card = state.players[0]!.cards.find((c) => c.id === id)!;
    state.players[1]!.heroHp = card.attack;
    const result = summon(state, 0, id, 0, getCombatType(card) === "melee" ? 0 : 2, 1, 1, random);
    expect(result.state.winner).toBe(0);
    expect(result.state.status).toBe("finished");
    expect(result.events.map((event) => event.type)).toEqual(["summon", "attack", "victory"]);
  });
});
describe("retrait du terrain", () => {
  it("discards a creature before summoning, without mutating input or advancing the turn", () => {
    const state = initial();
    const id = state.players[0]!.hand[0]!;
    unit(state, 0, id, 2, 1);
    const result = withdraw(state, 0, id, 1, 2);
    expect(state.players[0]!.board).toHaveLength(1);
    expect(result.state.players[0]!.board).toEqual([]);
    expect(result.state.players[0]!.discard).toEqual([id]);
    expect(result.state.players[0]!.hand).toEqual(state.players[0]!.hand);
    expect(result.state.hasSummoned).toBe(false);
    expect(result.state.turn).toBe(1);
    expect(result.events).toEqual([
      { seq: 1, type: "withdraw", player: 0, cardId: id, row: 2, depth: 1 },
    ]);
  });
  it("preserves an unused summon and allows withdrawing with a full hand", () => {
    const state = initial();
    const id = state.players[0]!.drawPile[0]!;
    unit(state, 0, id, 0, 0);
    const result = withdraw(state, 0, id, 1, 2).state;
    expect(result.players[0]!.hand).toHaveLength(4);
    expect(result.hasSummoned).toBe(false);
    const next = summon(
      result,
      0,
      result.players[0]!.hand[0]!,
      0,
      getCombatType(result.players[0]!.cards.find((card) => card.id === result.players[0]!.hand[0])!) === "melee" ? 0 : 2,
      1,
      3,
      random,
    ).state;
    expect(next.players[0]!.board).toHaveLength(1);
    expect(next.players[0]!.discard).toEqual([id]);
  });
  it("rejects enemy units, duplicate withdrawals, wrong or stale turns and deadlines", () => {
    const state = initial();
    unit(state, 1, "guardian", 0, 0);
    expect(() => withdraw(state, 0, "guardian", 1, 1)).toThrow("camp");
    unit(state, 0, "fox", 0, 0);
    expect(() => withdraw(state, 1, "guardian", 1, 1)).toThrow("tour");
    expect(() => withdraw(state, 0, "fox", 0, 1)).toThrow("changé");
    expect(() => withdraw(state, 0, "fox", 1, TURN_MS)).toThrow("écoulé");
    const removed = withdraw(state, 0, "fox", 1, 2).state;
    expect(() => withdraw(removed, 0, "fox", 1, 3)).toThrow("camp");
    expect(() => withdraw(surrender(state, 0).state, 0, "fox", 1, 3)).toThrow(
      "terminée",
    );
  });
  it("recycles withdrawn creatures when the draw pile runs out", () => {
    const state = initial();
    unit(state, 0, "fox", 0, 0, 1);
    state.players[0]!.drawPile = [];
    state.players[0]!.hand = [];
    const removed = withdraw(state, 0, "fox", 1, 1).state;
    const opponentTurn = endTurn(removed, 0, 1, 2, random).state;
    const next = endTurn(opponentTurn, 1, 2, 3, random).state;
    expect(next.players[0]!.hand).toEqual(["fox"]);
    expect(
      summon(next, 0, "fox", 1, 2, 3, 4, random).state.players[0]!.board[0]!.hp,
    ).toBe(3);
  });
});
describe("combat", () => {
  it("targets the nearest enemy in the same row, with ranged units firing behind melee", () => {
    const state = initial();
    unit(state, 0, "guardian", 1, 0);
    unit(state, 0, "owl", 1, 1);
    unit(state, 1, "turtle", 1, 0);
    unit(state, 1, "mushroom", 1, 2);
    unit(state, 1, "stag", 0, 0);
    const result = endTurn(state, 0, 1, 100, random);
    expect(
      result.events.filter((e) => e.type === "attack").map((e) => e.cardId),
    ).toEqual(["guardian", "owl"]);
    expect(
      result.state.players[1]!.board.find((u) => u.cardId === "mushroom")!.hp,
    ).toBe(8);
    expect(
      result.state.players[1]!.board.find((u) => u.cardId === "turtle")!.hp,
    ).toBe(6);
    expect(result.state.players[0]!.board[0]!.hp).toBe(9);
  });
  it("removes killed targets immediately, retargets and never carries excess damage", () => {
    const state = initial();
    unit(state, 0, "guardian", 0, 0);
    unit(state, 0, "dragon", 0, 1);
    unit(state, 0, "owl", 0, 2);
    unit(state, 1, "guardian", 0, 0, 1);
    unit(state, 1, "wisp", 0, 2, 2);
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
    unit(state, 0, "fox", 2, 2);
    unit(state, 0, "dragon", 0, 2);
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
  it.each([0, 1])("blocks only melee units behind allied melee on the same row for player %i", (player) => {
    const state = initial();
    state.activePlayer = player;
    unit(state, player, "guardian", 1, 0);
    unit(state, player, "stag", 1, 1);
    unit(state, player, "fox", 1, 2);
    unit(state, player, "owl", 0, 1);
    unit(state, player, "turtle", 2, 1);
    const own = state.players[player]!;
    expect(isMeleeBlocked(own.board[1]!, own.board, own.cards)).toBe(true);
    expect(isMeleeBlocked(own.board[4]!, own.board, own.cards)).toBe(false);
    const result = endTurn(state, player, 1, 1, random);
    expect(result.events.filter((event) => event.type === "attack").map((event) => event.cardId))
      .toEqual(["owl", "guardian", "fox", "turtle"]);
    expect(result.state.players[1 - player]!.heroHp).toBe(18);
  });
  it("blocks a newly summoned melee unit, then lets it act once the front unit is withdrawn", () => {
    const state = initial();
    unit(state, 0, "guardian", 0, 0);
    state.players[0]!.hand = ["stag"];
    const played = summon(state, 0, "stag", 0, 1, 1, 1, random);
    expect(played.events.filter((event) => event.type === "attack").map((event) => event.cardId)).toEqual(["guardian"]);
    const next = endTurn(played.state, 1, 2, 2, random).state;
    const removed = withdraw(next, 0, "guardian", 3, 3).state;
    const result = endTurn(removed, 0, 3, 4, random);
    expect(result.events.filter((event) => event.type === "attack").map((event) => event.cardId)).toEqual(["stag"]);
  });
  it("unblocks the rear melee unit after the front unit dies, including legacy snapshots", () => {
    const state = initial();
    state.activePlayer = 1;
    for (const player of state.players)
      player.cards = player.cards.map(({ combatType, ...card }) => card);
    unit(state, 0, "guardian", 0, 0, 1);
    unit(state, 0, "stag", 0, 1);
    unit(state, 1, "dragon", 0, 2);
    const next = endTurn(state, 1, 1, 1, random).state;
    expect(next.players[0]!.board.map((unit) => unit.cardId)).toEqual(["stag"]);
    const result = endTurn(next, 0, 2, 2, random);
    expect(result.events.filter((event) => event.type === "attack").map((event) => event.cardId)).toEqual(["stag"]);
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
    const invoked = summon(next, 1, "fox", 2, 2, 2, 20, random).state;
    expect(invoked.players[1]!.board[0]!.hp).toBe(3);
  });
  it("completes, rather than replaces, the next player's hand", () => {
    const state = initial();
    state.players[1]!.hand = ["fox"];
    state.players[1]!.drawPile = ["owl", "stag", "mushroom", "dragon"];
    const next = endTurn(state, 0, 1, 1, random).state;
    expect(next.players[1]!.hand).toEqual(["fox", "owl", "stag", "mushroom"]);
    expect(next.players[1]!.drawPile).toEqual(["dragon"]);
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
        const moves = player.hand.flatMap((cardId) => legalPlacements(
          player.cards.find((card) => card.id === cardId)!, player.board,
        ).map((cell) => ({ cardId, ...cell })));
        if (moves.length) {
          const move = moves[Math.floor(rng() * moves.length)]!;
          state = summon(
            state,
            index,
            move.cardId,
            move.row,
            move.depth,
            state.turn,
            turn * 1000,
            rng,
          ).state;
        } else state = endTurn(state, index, state.turn, turn * 1000 + 1, rng).state;
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
          expect(owner.board.every((unit) => unit.row < ROWS && isDeploymentDepth(
            owner.cards.find((card) => card.id === unit.cardId)!, unit.depth,
          ))).toBe(true);
        }
      }
      expect(state.status).toBe("finished");
    }
  });
});
