import { describe, expect, it } from "vitest";
import source from "../../../docs/references/cunt-wars/warlords.json";
import {
  HEROES,
  DEFAULT_DECK,
  createGame,
  heroStats,
  heroAbilities,
  heroMinion,
  heroProgress,
  nextHeroAbility,
  useHeroAbility,
  summon,
  endTurn,
  playerView,
  resolveCard,
  unitAttack,
  validateDeck,
  type GameState,
  type HeroId,
  type Unit,
  type CardDefinition,
} from "./index";
import { chooseComputerHeroAbility } from "./practice";

const random = () => 0;
function match(heroId: HeroId, level = 21, turn = 13) {
  const cards = validateDeck(DEFAULT_DECK);
  const state = createGame(
    [
      { userId: "a", name: "A", cards, heroId, heroLevel: level },
      { userId: "b", name: "B", cards, heroLevel: 21 },
    ],
    0,
    random,
    { field: false },
  );
  state.activePlayer = 0;
  state.turn = turn;
  return state;
}
function cast(state: GameState) {
  const p = state.players[0]!;
  const ability = nextHeroAbility(
    p.heroLevel!,
    p.heroAbilityUses ?? 0,
    state.turn,
    p.heroId,
  );
  return useHeroAbility(
    state,
    0,
    ability.id,
    p.heroAbilityUses ?? 0,
    state.turn,
    1,
    random,
  );
}
function place(
  state: GameState,
  player: number,
  options: Partial<Unit> = {},
  card?: CardDefinition,
) {
  const definition = card ?? {
    ...resolveCard("guardian:common", 10),
    abilities: [],
  };
  const unit: Unit = {
    cardId: definition.id,
    row: state.players[player]!.board.length,
    depth: 0,
    hp: definition.health,
    definition,
    ...options,
  };
  state.players[player]!.board.push(unit);
  return unit;
}

describe("les autres gardiens", () => {
  it("matches every independently collected HP and might threshold, including all 121 Maestro levels", () => {
    expect(HEROES).toHaveLength(11);
    for (const ref of source.heroes) {
      const hero = HEROES.find((h) => h.sourceName === ref.title)!;
      for (const row of ref.tables[1]!.slice(1)) {
        const stats = heroStats(Number(row[0]), hero.id);
        expect(stats.health).toBe(Number(row[2]));
        expect(stats.nextMight).toBe(
          row[1] === "Max Level" ? null : Number(row[1]),
        );
        const numbers = (value: string) =>
          (value.match(/\d+/g) ?? []).map(Number);
        expect(stats.storm).toBe(numbers(row[3]!)[0] ?? 0);
        expect(stats.archerAttack).toBe(numbers(row[4]!)[0] ?? 0);
        expect(stats.archerHealth).toBe(numbers(row[4]!)[1] ?? 0);
        expect(stats.attackBonus).toBe(numbers(row[5]!)[0] ?? 0);
      }
    }
    expect(heroStats(121, "maestro").health).toBe(2600);
    expect(
      heroProgress([], { level: 121, peakMight: 1e9, heroId: "north" }),
    ).toMatchObject({ level: 91, progressionLevel: 121, canUpgrade: false });
  });
  it("retains the collected gem prices and converts each CW league to Sylve trophies", () => {
    for (const ref of source.heroes) {
      const hero = HEROES.find((h) => h.sourceName === ref.title)!;
      const [price, league] = ref.unlock!.match(/\d+/g)!.map(Number);
      expect(hero.emeraldCost).toBe(price);
      expect(hero.requiredTrophies).toBe(league ? (30 - league) * 200 : 0);
    }
  });
  it.each(HEROES)(
    "resolves all four powers of $id without consuming the hand or deployment",
    (hero) => {
      let state = match(hero.id);
      for (let i = 0; i < 4; i++) {
        const result = cast(state);
        expect(result.events.some((e) => e.type === "hero_ability")).toBe(true);
        expect(result.state.players[0]!.hand).toEqual(state.players[0]!.hand);
        expect(result.state.hasSummoned).toBe(false);
        state = result.state;
        if (i === 2) state.turn = 21;
      }
      expect(state.players[0]!.heroAbilityUses).toBe(4);
    },
  );
  it("uses each family's actual unlock levels and first-turn availability", () => {
    expect(heroAbilities(1, 0, 1, "void")[0]!.state).toBe("ready");
    expect(heroAbilities(4, 1, 5, "void")[1]!.state).toBe("ready");
    expect(heroAbilities(15, 2, 13, "void")[2]!.state).toBe("ready");
    expect(heroAbilities(18, 2, 13, "weaver")[2]!.state).toBe("ready");
    expect(heroAbilities(1, 0, 1)[0]!.state).toBe("turn");
  });
  it("freezes only existing enemies for their next attack turn, respects immunity and shields, and then thaws", () => {
    let state = match("void");
    place(state, 1);
    place(state, 1, { shield: true });
    place(state, 1, { immune: true });
    state = cast(state).state;
    expect(state.players[1]!.board.map((u) => !!u.frozen)).toEqual([
      true,
      false,
      false,
    ]);
    expect(state.players[1]!.board[1]!.shield).toBe(false);
    state.players[1]!.board = [state.players[1]!.board[0]!];
    state = endTurn(state, 0, state.turn, 1, random).state;
    const hp = state.players[0]!.heroHp;
    state = endTurn(state, 1, state.turn, 2, random).state;
    expect(state.players[0]!.heroHp).toBe(hp);
    expect(state.players[1]!.board[0]!.frozen).toBeUndefined();
  });
  it("poisons creatures, spares buildings and executes only wounded, unprotected enemies", () => {
    let state = match("weaver");
    const creature = place(state, 1);
    place(state, 1, {}, { ...resolveCard("idol:rare"), abilities: [] });
    state = cast(state).state;
    expect(state.players[1]!.board[0]!.poisoned).toBe(5);
    expect(state.players[1]!.board[1]!.poisoned).toBeUndefined();
    state.players[1]!.board = [];
    place(state, 1, { hp: creature.hp - 1 });
    place(state, 1);
    place(state, 1, { hp: creature.hp - 1, shield: true });
    place(state, 1, { hp: creature.hp - 1, immune: true });
    state = cast(state).state;
    expect(state.players[1]!.board.map((u) => u.row)).toEqual([1, 2, 3]);
    expect(state.players[1]!.board[1]!.shield).toBe(false);
  });
  it("summons up to four ephemeral witches and removes them at their owner's next turn", () => {
    let state = match("weaver", 18);
    state.players[0]!.heroAbilityUses = 2;
    state = cast(state).state;
    expect(state.players[0]!.board).toHaveLength(4);
    expect(
      state.players[0]!.board.every((u) => u.depth >= 1 && u.hp === 1),
    ).toBe(true);
    state = endTurn(state, 0, state.turn, 1, random).state;
    state = endTurn(state, 1, state.turn, 2, random).state;
    expect(state.players[0]!.board).toHaveLength(0);
  });
  it("retaliates on hero hits for two opposing turns and expires without mutating the input", () => {
    const input = match("thorn", 1, 1);
    place(input, 1, { attack: 1, hp: 30 });
    let state = cast(input).state;
    expect(input.players[0]!.heroSpikes).toBeUndefined();
    for (let i = 0; i < 3; i++) {
      state = endTurn(state, 0, state.turn, 1, random).state;
      state = endTurn(state, 1, state.turn, 2, random).state;
    }
    expect(state.players[1]!.board[0]!.hp).toBe(12);
    expect(state.players[0]!.heroSpikes).toBeUndefined();
  });
  it("lets preemptive retaliation kill an attacker before it hits, with normal death resolution", () => {
    let state = match("flame", 1, 1);
    place(state, 1, { hp: 3, attack: 9 });
    state = cast(state).state;
    state = endTurn(state, 0, state.turn, 1, random).state;
    const hp = state.players[0]!.heroHp;
    state = endTurn(state, 1, state.turn, 2, random).state;
    expect(state.players[1]!.board).toHaveLength(0);
    expect(state.players[0]!.heroHp).toBe(hp);
  });
  it("creates real block runes and spares melee units from fragility", () => {
    let state = cast(match("maestro")).state;
    expect(state.players[0]!.runes).toHaveLength(5);
    expect(
      state.players[0]!.runes!.every((r) => r.block === 16 && !r.activated),
    ).toBe(true);
    place(state, 1);
    place(state, 1, {}, { ...resolveCard("fox:common"), abilities: [] });
    place(state, 1, {}, { ...resolveCard("idol:rare"), abilities: [] });
    state.players[0]!.heroAbilityUses = 2;
    const hp = state.players[1]!.board[0]!.hp;
    state = cast(state).state;
    expect(state.players[1]!.board.map((u) => u.hp)).toEqual([hp, 1, 1]);
  });
  it("buffs only the matching faction or combat type, and keeps ranged power permanent", () => {
    let state = match("thorn");
    state.players[0]!.heroAbilityUses = 2;
    place(
      state,
      0,
      { attack: 1 },
      { ...resolveCard("bear:common"), abilities: [] },
    );
    place(state, 0, { attack: 1 });
    state = cast(state).state;
    expect(
      state.players[0]!.board.map((u) => unitAttack(u, state.players[0]!)),
    ).toEqual([8, 1]);
    state = endTurn(state, 0, state.turn, 1, random).state;
    expect(unitAttack(state.players[0]!.board[0]!, state.players[0]!)).toBe(1);
    state = match("void");
    state.players[0]!.heroAbilityUses = 2;
    place(
      state,
      0,
      { attack: 1 },
      { ...resolveCard("fox:common"), abilities: [] },
    );
    place(state, 0, { attack: 1 });
    state = cast(state).state;
    state = endTurn(state, 0, state.turn, 1, random).state;
    expect(
      state.players[0]!.board.map((u) => unitAttack(u, state.players[0]!)),
    ).toEqual([11, 1]);
  });
  it("retains the source-specific skills and exact minion statistics", () => {
    expect(heroMinion("north", 21, "knight")).toMatchObject({
      attack: 2,
      health: 13,
      combatType: "melee",
      faction: "order",
      abilities: [expect.objectContaining({ effect: "block", value: 2 })],
    });
    expect(heroMinion("shaman", 21, "totem")).toMatchObject({
      health: 24,
      combatType: "building",
      abilities: [expect.objectContaining({ effect: "reflect_damage" })],
    });
    expect(heroMinion("moon", 21, "vampire")).toMatchObject({
      attack: 4,
      health: 19,
      abilities: [
        expect.objectContaining({ value: 2 }),
        expect.objectContaining({ value: 2 }),
      ],
    });
    expect(heroMinion("void", 21, "demon").abilities![0]!.effect).toBe(
      "freeze",
    );
    expect(heroMinion("shadow", 21, "shadow").abilities![0]).toMatchObject({
      effect: "set_attack",
      count: 2,
    });
  });
  it("lets AI read the snapshotted hero rather than defaulting to Adam", () => {
    const state = match("void", 4, 5);
    state.players[0]!.heroAbilityUses = 1;
    expect(chooseComputerHeroAbility(playerView(state, "a"))?.id).toBe(
      "call_of_void",
    );
  });
  it("applies a block rune exactly once to the unit entering it", () => {
    const state = cast(match("maestro")).state;
    const cell = state.players[0]!.runes!.find((r) => r.depth === 0)!;
    const card = state.players[0]!.hand.find((id) =>
      id.startsWith("guardian:"),
    )!;
    const result = summon(
      state,
      0,
      card,
      cell.row,
      cell.depth,
      state.turn,
      1,
      random,
    );
    expect(
      result.state.players[0]!.board.find(
        (u) => u.row === cell.row && u.depth === cell.depth,
      )!.block,
    ).toBe(18);
    expect(
      result.state.players[0]!.runes!.find(
        (r) => r.row === cell.row && r.depth === cell.depth,
      )!.activated,
    ).toBe(true);
  });
  it("lets a summoned Void spirit freeze its attack target", () => {
    let state = match("void");
    state.players[0]!.heroAbilityUses = 1;
    place(state, 1, { hp: 100, attack: 1 });
    state = cast(state).state;
    state = endTurn(state, 0, state.turn, 1, random).state;
    expect(state.players[1]!.board[0]).toMatchObject({ hp: 76, frozen: true });
  });
  it("reflects the damage taken by a totem to the opposing hero", () => {
    let state = match("shaman");
    state.players[0]!.heroAbilityUses = 1;
    place(state, 1, { hp: 100, attack: 5 });
    state = cast(state).state;
    state = endTurn(state, 0, state.turn, 1, random).state;
    const before = state.players[1]!.heroHp;
    state = endTurn(state, 1, state.turn, 2, random).state;
    expect(state.players[1]!.heroHp).toBe(before - 5);
  });
  it("detonates a destroyed gift against every enemy on its line", () => {
    let state = match("winter");
    place(state, 1, { hp: 19, attack: 50 });
    place(state, 1, { hp: 19, attack: 0, row: 0, depth: 1 });
    place(state, 1, { hp: 100, attack: 0, row: 3 });
    state = cast(state).state;
    state = endTurn(state, 0, state.turn, 1, random).state;
    state = endTurn(state, 1, state.turn, 2, random).state;
    expect(state.players[1]!.board.map((u) => u.row)).toEqual([3]);
    expect(state.players[1]!.board[0]!.hp).toBe(100);
  });
});
