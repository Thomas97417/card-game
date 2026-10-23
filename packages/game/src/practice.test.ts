import { describe, expect, it } from "vitest";
import { legacyDeck } from "./legacy-fixture";
import {
  CATALOG,
  DEFAULT_DECK as STARTER_DECK,
  createGame,
  endTurn,
  isDeploymentDepth,
  playerView,
  summon,
  validateDeck,
  variantCard,
  getCombatType,
  RARITIES,
  MAX_CARD_LEVEL,
  type GameState,
} from "./index";
import {
  PRACTICE_COMPUTER_ID,
  PRACTICE_DEADLINE,
  PRACTICE_PLAYER_ID,
  chooseComputerMove,
  createPracticeGame,
  computerDeckForLeague,
  computerProfile,
  COMPUTER_MEMORY_LENGTH,
} from "./practice";
import { LEAGUES } from "./leagues";

const DEFAULT_DECK = CATALOG.slice(0, 8).map((card) => card.id);

function initial() {
  const state = createGame(
    [
      {
        userId: PRACTICE_PLAYER_ID,
        name: "Toi",
        cards: legacyDeck(DEFAULT_DECK),
      },
      {
        userId: PRACTICE_COMPUTER_ID,
        name: "Ordinateur",
        cards: legacyDeck(DEFAULT_DECK),
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
  it("starts Iron IV with exactly the four starter creatures, common and level one", () => {
    const human = STARTER_DECK.map((id) =>
      variantCard(id.split(":")[0]!, "legendary", 10),
    );
    const computer = computerDeckForLeague(0, human, () => 0.25);
    expect(computer.map((card) => card.id).sort()).toEqual(
      [...STARTER_DECK].sort(),
    );
    expect(
      computer.every((card) => card.level === 1 && card.rarity === "common"),
    ).toBe(true);
    expect(computer.reduce((sum, card) => sum + card.attack, 0)).toBe(13);
  });

  it("progressively unlocks creatures, rarities and levels by league, capped by the human deck's upgrades", () => {
    for (const league of LEAGUES) {
      const human = CATALOG.slice(0, 8).map((base) =>
        variantCard(base.id, "legendary", MAX_CARD_LEVEL),
      );
      const profile = computerProfile(league.minTrophies);
      const computer = computerDeckForLeague(
        league.minTrophies,
        human,
        () => 0.25,
      );
      expect(computer).toHaveLength(human.length);
      expect(new Set(computer.map((card) => card.baseId)).size).toBe(
        human.length,
      );
      expect(
        computer.every(
          (card) =>
            card.level === profile.maxLevel &&
            card.rarity === profile.maxRarity,
        ),
      ).toBe(true);
      expect(computer.some((card) => getCombatType(card) === "melee")).toBe(
        true,
      );
      expect(computer.some((card) => getCombatType(card) === "ranged")).toBe(
        true,
      );
      const basic = computerDeckForLeague(
        league.minTrophies,
        validateDeck(STARTER_DECK),
        () => 0.25,
      );
      expect(
        basic.every((card) => card.level === 1 && card.rarity === "common"),
      ).toBe(true);
      if (league.index >= 8) expect(profile.baseIds).toContain("dragon");
      else expect(profile.baseIds).not.toContain("dragon");
    }
    expect(RARITIES.indexOf(computerProfile(1600).maxRarity)).toBe(1);
    expect(computerProfile(6000).maxLevel).toBe(26);
  });

  it("supports retained eight-slot decks after a demotion without bringing high-attack creatures into Iron IV", () => {
    const human = CATALOG.slice(0, 8).map((base) =>
      variantCard(base.id, "common"),
    );
    const computer = computerDeckForLeague(0, human, () => 0.25);
    expect(computer).toHaveLength(8);
    expect(computer.every((card) => card.attack <= 4 && card.level === 1)).toBe(
      true,
    );
  });
  it("can include one unlocked support building while keeping melee and ranged attackers", () => {
    const human = validateDeck(STARTER_DECK);
    const before = computerDeckForLeague(1800, human, () => 0.25);
    expect(before.some((card) => getCombatType(card) === "building")).toBe(
      false,
    );
    const after = computerDeckForLeague(2000, human, () => 0.25);
    expect(
      after.filter((card) => getCombatType(card) === "building"),
    ).toHaveLength(1);
    expect(after.some((card) => getCombatType(card) === "melee")).toBe(true);
    expect(after.some((card) => getCombatType(card) === "ranged")).toBe(true);
  });
  it("offers a four-card local starter and a matching computer deck", () => {
    const state = createPracticeGame(STARTER_DECK, 0, () => 0.25);
    expect(state.players.map((player) => player.cards.length)).toEqual([4, 4]);
    expect(state.players.map((player) => player.drawPile.length)).toEqual([
      0, 0,
    ]);
  });
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
    expect(() => createPracticeGame(deck.slice(0, 3), 0, () => 0.25)).toThrow(
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

  it("avoids repeating its last creature whenever another safe creature is playable", () => {
    const state = initial();
    state.players[1]!.hand = ["fox", "wisp", "mushroom", "turtle"];
    const move = chooseComputerMove(
      playerView(state, PRACTICE_COMPUTER_ID),
      () => 0.25,
      ["fox"],
    );
    expect(move?.cardId).not.toBe("fox");
    expect(state.players[1]!.hand).toContain(move!.cardId);
  });

  it("uses recent history to vary multiple choices and keeps tactical wins ahead of repetition avoidance", () => {
    const state = initial();
    state.players[1]!.hand = ["fox", "wisp", "mushroom", "turtle"];
    const history: string[] = [];
    const played = [];
    for (let i = 0; i < 8; i++) {
      const move = chooseComputerMove(
        playerView(state, PRACTICE_COMPUTER_ID),
        () => 0.25,
        history,
      )!;
      expect(move.cardId).not.toBe(history.at(-1));
      played.push(move.cardId);
      history.push(move.cardId);
      if (history.length > COMPUTER_MEMORY_LENGTH) history.shift();
    }
    expect(new Set(played).size).toBeGreaterThanOrEqual(3);
    state.players[0]!.heroHp = 5;
    const lethal = chooseComputerMove(
      playerView(state, PRACTICE_COMPUTER_ID),
      () => 0.25,
      ["fox"],
    );
    expect(lethal?.cardId).toBe("fox");
  });

  it("repeats a creature when it is the only safe way to block lethal damage", () => {
    const state = initial();
    state.players[1]!.hand = ["dragon", "turtle"];
    state.players[1]!.heroHp = 5;
    const attacker = variantCard("mushroom", "common", 10);
    state.players[0]!.cards = [attacker];
    state.players[0]!.hand = [attacker.id];
    state.players[0]!.board = [1, 2].map((depth) => ({
      cardId: attacker.id,
      row: 2,
      depth,
      hp: attacker.health,
    }));
    const move = chooseComputerMove(
      playerView(state, PRACTICE_COMPUTER_ID),
      () => 0.25,
      ["turtle"],
    );
    expect(move).toMatchObject({ cardId: "turtle", row: 2 });
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
  it("finishes simulated training matches with a full unique hand and legal positions", () => {
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
      const histories: string[][] = [[], []];
      for (let turn = 0; turn < 200 && state.status === "active"; turn++) {
        const player = state.activePlayer;
        const move = chooseComputerMove(
          playerView(state, state.players[player]!.userId),
          random,
          histories[player],
        );
        if (move) {
          histories[player]!.push(move.cardId);
          histories[player] = histories[player]!.slice(-COMPUTER_MEMORY_LENGTH);
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
        } else
          state = endTurn(
            state,
            player,
            state.turn,
            turn * 100 + 1,
            random,
          ).state;
        for (const [index, owner] of state.players.entries()) {
          expect([...owner.hand, ...owner.drawPile].sort()).toEqual(
            decks[index],
          );
          expect(owner.hand).toHaveLength(4);
          expect(new Set(owner.hand).size).toBe(4);
          expect(owner.discard).toEqual([]);
          expect(
            owner.board.every((unit) => decks[index]!.includes(unit.cardId)),
          ).toBe(true);
          expect(
            owner.board.every((unit) =>
              isDeploymentDepth(
                owner.cards.find((card) => card.id === unit.cardId)!,
                unit.depth,
              ),
            ),
          ).toBe(true);
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
