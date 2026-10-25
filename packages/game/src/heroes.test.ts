import { describe, expect, it } from "vitest";
import reference from "../../../docs/references/cunt-wars/adam.json";
import {
  DEFAULT_DECK,
  HERO_LEVELS,
  MAX_HERO_LEVEL,
  createGame,
  deckMight,
  endTurn,
  heroAbilities,
  heroLevelForDeck,
  heroMight,
  heroProgress,
  heroStats,
  nextHeroAbility,
  playerView,
  resolveCard,
  summon,
  unitAttack,
  useHeroAbility,
  validateDeck,
  type GameState,
  type Unit,
} from "./index";
import { chooseComputerHeroAbility } from "./practice";

const random = () => 0.25;
function match(level = 21, ownTurn = 1) {
  const cards = validateDeck(DEFAULT_DECK);
  const state = createGame(
    [
      { userId: "a", name: "A", cards, heroLevel: level },
      { userId: "b", name: "B", cards, heroLevel: 1 },
    ],
    0,
    random,
    { field: false },
  );
  state.activePlayer = 0;
  state.turn = ownTurn * 2 - 1;
  return state;
}
function cast(
  state: GameState,
  id = nextHeroAbility(
    state.players[0]!.heroLevel!,
    state.players[0]!.heroAbilityUses ?? 0,
    state.turn,
  ).id,
) {
  return useHeroAbility(
    state,
    0,
    id,
    state.players[0]!.heroAbilityUses ?? 0,
    state.turn,
    1,
    random,
  );
}
function unit(
  state: GameState,
  player: number,
  properties: Partial<Unit> = {},
) {
  const card = state.players[player]!.cards[0]!;
  const target: Unit = {
    cardId: card.id,
    row: 0,
    depth: 0,
    hp: card.health,
    ...properties,
  };
  state.players[player]!.board.push(target);
  return target;
}

describe("progression du héros", () => {
  it("reproduces every numeric value of the 91 collected wiki rows", () => {
    expect(HERO_LEVELS).toHaveLength(91);
    for (const [index, row] of reference.tables[1]!.slice(1).entries()) {
      const [level, threshold, health, storm, archers, attack] = row;
      const [archerAttack, archerHealth] =
        archers === "(locked)" ? [0, 0] : archers!.split("/").map(Number);
      expect(HERO_LEVELS[index]).toEqual({
        level: Number(level),
        nextMight: threshold === "Max Level" ? null : Number(threshold),
        health: Number(health),
        storm: Number(storm),
        archerAttack,
        archerHealth,
        attackBonus: attack === "(locked)" ? 0 : Number(attack),
      });
    }
  });
  it("uses row N's threshold to reach N+1 and preserves eligibility after a weaker deck", () => {
    const cards = [{ id: "a", might: 869 }];
    expect(heroProgress(cards).canUpgrade).toBe(false);
    cards[0]!.might++;
    expect(heroProgress(cards).canUpgrade).toBe(true);
    expect(heroProgress([], { level: 1, peakMight: 870 }).canUpgrade).toBe(
      true,
    );
    expect(heroProgress([], { level: 2, peakMight: 870 }).canUpgrade).toBe(
      false,
    );
    expect(heroMight(2)).toBe(10);
    expect(heroStats(2).health).toBe(49);
  });
  it("counts only distinct equipped variants, including sourced Soulbind bonuses", () => {
    const common = resolveCard("guardian:common");
    const bound = resolveCard("guardian:common", 1, [1]);
    expect(deckMight([common, common])).toBe(common.might);
    expect(deckMight([bound])).toBe(common.might! + 10);
    expect(deckMight([common, resolveCard("guardian:rare")])).toBe(220);
    expect(heroProgress(validateDeck(DEFAULT_DECK)).cardMight).toBe(400);
  });
  it("starts sourced games at 45 HP, snapshots levels, and caps automatic progression", () => {
    const state = match();
    expect(state.players[0]!.heroHp).toBe(120);
    expect(state.players[1]!.heroHp).toBe(45);
    expect(playerView(state, "b").players[0]!.heroLevel).toBe(21);
    expect(heroLevelForDeck([{ id: "max", might: 1_000_000 }])).toBe(
      MAX_HERO_LEVEL,
    );
    expect(heroStats(MAX_HERO_LEVEL).health).toBe(1475);
    expect(heroProgress([], { level: 91, peakMight: 1e9 }).canUpgrade).toBe(
      false,
    );
    expect(() => heroStats(0)).toThrow();
    expect(() => heroStats(92)).toThrow();
  });
});

describe("pile de pouvoirs du héros", () => {
  it.each([
    ["storm", 2, 1, 0],
    ["call_to_arms", 3, 11, 1],
    ["heavenly_power", 7, 21, 2],
    ["sudden_death", 11, 21, 3],
  ] as const)(
    "unlocks %s at personal turn %i for either starting position",
    (id, readyTurn, level, uses) => {
      for (const offset of [0, 1]) {
        const turn = readyTurn * 2 - 1 + offset;
        expect(nextHeroAbility(level, uses, turn - 2)).toMatchObject({
          id,
          readyTurn,
          state: "turn",
        });
        expect(nextHeroAbility(level, uses, turn)).toMatchObject({
          id,
          readyTurn,
          state: "ready",
        });
      }
    },
  );
  it("still enforces hero levels and pile order after the required turn", () => {
    expect(heroAbilities(1, 1, 99)[1]!.state).toBe("level");
    expect(heroAbilities(11, 2, 99)[2]!.state).toBe("level");
    expect(heroAbilities(11, 3, 99)[3]!.state).toBe("level");
    expect(heroAbilities(21, 0, 99)[1]!.state).toBe("previous");
  });
  it.each([0, 1])(
    "blocks player %i's first Storm until their second personal turn",
    (player) => {
      for (const firstTurn of [1, 2]) {
        const state = match(1);
        state.activePlayer = player;
        state.turn = firstTurn;
        const original = structuredClone(state);
        expect(() =>
          useHeroAbility(state, player, "storm", 0, firstTurn, 1, random),
        ).toThrow("tour 2");
        expect(state).toEqual(original);
        state.turn += 2;
        const result = useHeroAbility(
          state, player, "storm", 0, state.turn, 1, random,
        );
        expect(result.state.players[player]!.heroAbilityUses).toBe(1);
      }
    },
  );
  it("enforces order, single use, turn, deadline and deployment on the server rules", () => {
    const state = match(21, 2);
    expect(() => cast(state, "call_to_arms")).toThrow("premier pouvoir");
    expect(() => useHeroAbility(state, 1, "storm", 0, 3, 1, random)).toThrow(
      "ton tour",
    );
    expect(() => useHeroAbility(state, 0, "storm", 0, 4, 1, random)).toThrow(
      "tour a changé",
    );
    expect(() =>
      useHeroAbility(state, 0, "storm", 0, 3, state.turnEndsAt, random),
    ).toThrow("écoulé");
    const next = cast(state).state;
    expect(() => useHeroAbility(next, 0, "storm", 0, 3, 1, random)).toThrow(
      "pile",
    );
    expect(() => cast(next)).toThrow("tour 3");
    state.hasSummoned = true;
    expect(() => cast(state)).toThrow("avant d’invoquer");
    state.status = "finished";
    expect(() => cast(state)).toThrow("terminée");
  });
  it("damages enemy units with shields, immunity and deaths, keeping the hand and timer intact", () => {
    const state = match(1, 2);
    unit(state, 1, { hp: 2 });
    unit(state, 1, { row: 1, shield: true, hp: 8 });
    unit(state, 1, { row: 2, immune: true, hp: 8 });
    const original = structuredClone(state);
    const result = cast(state);
    expect(state).toEqual(original);
    expect(result.state.players[1]!.board).toHaveLength(2);
    expect(result.state.players[1]!.board[0]).toMatchObject({
      hp: 8,
      shield: false,
    });
    expect(result.state.players[1]!.board[1]!.hp).toBe(8);
    expect(result.state.players[1]!.heroHp).toBe(45);
    expect(result.state.players[0]!.hand).toEqual(state.players[0]!.hand);
    expect(result.state).toMatchObject({
      activePlayer: 0,
      turn: 3,
      hasSummoned: false,
      turnEndsAt: state.turnEndsAt,
    });
    expect(result.events.some((e) => e.type === "death")).toBe(true);
    expect(result.events[0]).toMatchObject({
      type: "hero_ability",
      heroAbility: "storm",
      heroAbilityUses: 1,
    });
  });
  it("allows an empty first spell to expose the next one and still permits character deployment", () => {
    const result = cast(match(1, 2));
    expect(result.state.players[0]!.heroAbilityUses).toBe(1);
    const deployed = summon(
      result.state,
      0,
      result.state.players[0]!.hand[0]!,
      0,
      1,
      result.state.turn,
      2,
      random,
    );
    expect(deployed.state.turn).toBe(4);
    expect(deployed.state.players[0]!.heroAbilityUses).toBe(1);
  });
  it("summons plain ranged Order reinforcements, reacts to their arrival and activates field runes", () => {
    const state = match(11, 3);
    state.players[0]!.heroAbilityUses = 1;
    // Constant random puts the first chosen cell at row zero, depth two.
    const result = cast(state);
    const board = result.state.players[0]!.board;
    expect(board).toHaveLength(2);
    for (const token of board) {
      expect(token.depth).toBeGreaterThanOrEqual(1);
      expect(token.definition).toMatchObject({
        attack: 6,
        health: 1,
        combatType: "ranged",
        level: 1,
        faction: "order",
        gender: "female",
        abilities: [],
      });
    }
    expect(result.events.filter((e) => e.type === "summon")).toHaveLength(2);
    expect(result.state.hasSummoned).toBe(false);
    const marked = match(11, 3);
    marked.players[0]!.heroAbilityUses = 1;
    marked.players[0]!.runes = board.map((u) => ({
      row: u.row,
      depth: u.depth,
      health: 3,
    }));
    expect(cast(marked).state.players[0]!.board.every((u) => u.hp === 4)).toBe(
      true,
    );
  });
  it("summons only into available ranged cells without overwriting an occupant", () => {
    const state = match(11, 3);
    state.players[0]!.heroAbilityUses = 1;
    for (let row = 0; row < 4; row++)
      for (let depth = 1; depth < 3; depth++)
        if (row !== 3 || depth !== 2) unit(state, 0, { row, depth });
    const result = cast(state);
    expect(result.state.players[0]!.board).toHaveLength(8);
    expect(result.events.filter((e) => e.type === "summon")).toHaveLength(1);
    expect(
      new Set(result.state.players[0]!.board.map((u) => `${u.row}:${u.depth}`))
        .size,
    ).toBe(8);
  });
  it("stacks three ready spells in one turn and removes Heavenly Power after its owner's attack", () => {
    let state = match(21, 7);
    unit(state, 0);
    const base = unitAttack(state.players[0]!.board[0]!, state.players[0]!);
    for (let i = 0; i < 3; i++) state = cast(state).state;
    expect(state.players[0]!.heroAbilityUses).toBe(3);
    expect(unitAttack(state.players[0]!.board[0]!, state.players[0]!)).toBe(
      base + 7,
    );
    const result = endTurn(state, 0, state.turn, 2, random);
    expect(
      result.state.players[0]!.board.every((u) => !u.temporaryAttack),
    ).toBe(true);
    expect(
      unitAttack(result.state.players[0]!.board[0]!, result.state.players[0]!),
    ).toBe(base);
  });
  it("accumulates Sudden Death cards, increases their damage, and resolves victory", () => {
    let state = match(21, 13);
    state.players[0]!.heroAbilityUses = 3;
    expect(nextHeroAbility(21, 3, 20).state).toBe("turn");
    for (const damage of [6, 12, 18]) {
      const before = state.players[1]!.heroHp;
      state = cast(state).state;
      expect(state.players[1]!.heroHp).toBe(before - damage);
    }
    expect(() => cast(state)).toThrow("tour 14");
    state.turn = 27;
    const result = cast(state);
    expect(result.state).toMatchObject({ status: "finished", winner: 0 });
    expect(result.state.players[1]!.heroHp).toBe(0);
  });
  it("keeps pre-progression saved games on their existing rules", () => {
    const state = match();
    delete state.players[0]!.heroLevel;
    state.players[0]!.heroHp = 30;
    delete state.players[0]!.heroMaxHp;
    expect(() => cast(state)).toThrow();
    expect(
      endTurn(state, 0, state.turn, 2, random).state.players[0]!.heroHp,
    ).toBe(30);
  });
  it("lets the computer choose only visible, ready spells", () => {
    const state = match(11, 3);
    expect(chooseComputerHeroAbility(playerView(state, "a"))?.id).toBe("storm");
    state.players[0]!.heroAbilityUses = 1;
    expect(chooseComputerHeroAbility(playerView(state, "a"))?.id).toBe(
      "call_to_arms",
    );
    expect(chooseComputerHeroAbility(playerView(state, "b"))).toBeNull();
    expect(chooseComputerHeroAbility(playerView(match(1), "a"))).toBeNull();
  });
  it("makes the computer wait for its second turn even when Storm has a target", () => {
    const state = match(1);
    unit(state, 1);
    for (const firstTurn of [1, 2]) {
      state.turn = firstTurn;
      expect(chooseComputerHeroAbility(playerView(state, "a"))).toBeNull();
      state.turn += 2;
      expect(chooseComputerHeroAbility(playerView(state, "a"))?.id).toBe("storm");
    }
  });
});
