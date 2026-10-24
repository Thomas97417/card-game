import { describe, expect, it } from "vitest";
import reference from "../../../docs/references/mighty-party/legendary-cards.json";
import commonReference from "../../../docs/references/mighty-party/common-cards.json";
import {
  CATALOG,
  createGame,
  resolveCard,
  variantCard,
  maxCardLevel,
  upgradeCost,
  upgradeGoldCost,
  summon,
  endTurn,
  playerView,
  unitAttack,
  legalPlacements,
  type GameState,
  type Unit,
} from "./index";
const random = () => 0;
function fresh(...ids: string[]) {
  const cards = [
    ...new Set([
      ...ids,
      "guardian:common",
      "turtle:common",
      "fox:common",
      "wisp:common",
    ]),
  ].map((id) => resolveCard(id));
  const state = createGame(
    [
      { userId: "a", name: "A", cards },
      { userId: "b", name: "B", cards },
    ],
    0,
    random,
    { field: false },
  );
  state.activePlayer = 0;
  return state;
}
function put(
  state: GameState,
  p: number,
  id: string,
  row: number,
  depth: number,
  extra: Partial<Unit> = {},
) {
  const owner = state.players[p]!;
  if (!owner.cards.some((c) => c.id === id)) owner.cards.push(resolveCard(id));
  const card = owner.cards.find((c) => c.id === id)!;
  const u: Unit = { cardId: id, row, depth, hp: card.health, ...extra };
  owner.board.push(u);
  return u;
}
function deploy(state: GameState, id: string, row = 0, depth?: number, p = 0) {
  const owner = state.players[p]!;
  if (!owner.cards.some((c) => c.id === id)) owner.cards.push(resolveCard(id));
  const card = owner.cards.find((c) => c.id === id)!;
  owner.hand = [
    id,
    ...owner.cards
      .filter((c) => c.id !== id)
      .slice(0, 3)
      .map((c) => c.id),
  ];
  state.activePlayer = p;
  state.hasSummoned = false;
  return summon(
    state,
    p,
    id,
    row,
    depth ?? (card.combatType === "ranged" ? 2 : 0),
    state.turn,
    0,
    random,
  );
}
function attack(state: GameState, p = 0) {
  state.activePlayer = p;
  return endTurn(state, p, state.turn, 0, random);
}
function robust(state: GameState) {
  for (const p of state.players) {
    p.heroHp = 200;
    p.heroMaxHp = 200;
  }
  return state;
}
const baseFor = (name: string) =>
  CATALOG.find(
    (b) =>
      b.sourceHero ===
      reference.chains.find((c) => c.legendary === name)!.common,
  )!;

describe("documented Legendary profiles", () => {
  it("preserves the 20 reciprocal evolutions, 620 stat pairs, 60 skills and every sourced cost", () => {
    expect(reference.cards).toHaveLength(20);
    expect(reference.cards.reduce((n, c) => n + c.skills.length, 0)).toBe(60);
    for (const source of reference.cards) {
      const base = baseFor(source.name);
      const chain = reference.chains.find((c) => c.legendary === source.name)!;
      expect(source.evolvesFrom).toBe(chain.epic);
      expect(source.levels).toHaveLength(31);
      for (const row of source.levels) {
        const card = variantCard(base.id, "legendary", row.level);
        expect([card.attack, card.health]).toEqual([row.attack, row.health]);
        expect(card.sourceHero).toBe(source.name);
        expect(card.gender).toBe(source.gender);
        expect(card.combatType).toBe(source.combatType);
        expect(card.faction).toBe(source.faction);
        expect(card.artId).toBe(`evolutions/${base.id}-legendary`);
        source.skills.forEach((skill, i) => {
          const ability = card.abilities![i]!;
          const point = [...skill.progression]
            .reverse()
            .find((p) => p.level <= row.level)!;
          expect(ability.active).toBe(row.level >= skill.unlockLevel);
          expect(ability.unlockLevel).toBe(skill.unlockLevel);
          expect(ability.description).not.toMatch(/\{|undefined|NaN/);
          if ("value" in point) expect(ability.value).toBe(point.value);
          if ("attack" in point)
            expect(ability.summon).toMatchObject({
              attack: point.attack,
              health: point.health,
              level: point.summonLevel,
            });
        });
        const price =
          commonReference.economy.byRarity.legendary[row.level - 1]!;
        expect(row.cost).toEqual([price.soulsToReach, price.goldToReach]);
      }
      expect(maxCardLevel("legendary", base.id)).toBe(31);
      expect(upgradeCost(30, "legendary")).toBeGreaterThan(0);
      expect(upgradeGoldCost(31, "legendary")).toBe(0);
      expect(() => variantCard(base.id, "legendary", 32)).toThrow();
    }
  });
  it("keeps both unsourced Sylve buildings explicit, independent and capped at 26", () => {
    expect(reference.missingEvolutions.map((c) => c.epic).sort()).toEqual([
      "Caesar's Head",
      "Cursed Oak",
    ]);
    for (const id of ["idol", "tree"]) {
      const card = variantCard(id, "legendary", 26);
      expect(card.title).toContain("Création Sylve");
      expect(card.artId).toBeUndefined();
      expect(card.attack).toBe(0);
      expect(card.health).toBe(variantCard(id, "common", 26).health + 8);
      expect(maxCardLevel("legendary", id)).toBe(26);
      expect(() => variantCard(id, "legendary", 27)).toThrow();
    }
  });
});

describe("Legendary mechanics", () => {
  it("deploys Prince's two archers, then a Squire with its own blocking skills after an enemy death", () => {
    let state = deploy(
      robust(fresh("guardian:legendary")),
      "guardian:legendary",
      0,
      1,
    ).state;
    expect(
      state.players[0]!.board.find((u) => u.definition)?.definition,
    ).toMatchObject({ attack: 5, health: 4 });
    put(state, 1, "guardian:common", 0, 0, { hp: 1, attack: 0 });
    state = attack(state).state;
    const squire = state.players[0]!.board.find(
      (u) => u.definition?.kind === "squire",
    )!;
    expect(squire).toMatchObject({ row: 0, depth: 0, hp: 10, block: 2 });
    expect(squire.definition?.abilities).toHaveLength(2);
    expect(state.players[0]!.cards.some((c) => c.id === squire.cardId)).toBe(
      false,
    );
    const source31 = resolveCard("guardian:legendary", 31);
    const top = fresh("guardian:legendary");
    top.players[0]!.cards = top.players[0]!.cards.map((c) =>
      c.id === source31.id ? source31 : c,
    );
    const tokens = deploy(top, source31.id).state.players[0]!.board.filter(
      (u) => u.definition,
    );
    expect(tokens).toHaveLength(2);
    expect(tokens[0]!.definition!.abilities![0]!.value).toBe(32);
  });
  it("gives Alexandria a healing building with a working deploy skill", () => {
    const state = robust(fresh("owl:legendary"));
    state.players[0]!.heroHp = 10;
    state.players[0]!.heroMaxHp = 30;
    const result = deploy(state, "owl:legendary", 0, 2).state;
    const altar = result.players[0]!.board.find(
      (u) => u.definition?.kind === "life_palace",
    )!;
    expect(altar).toMatchObject({ row: 0, depth: 1, hp: 30 });
    expect(altar.definition!.combatType).toBe("building");
    expect(result.players[0]!.heroHp).toBe(16);
  });
  it("spawns Tesla only on a free ranged cell and triggers its skill once per death", () => {
    let state = deploy(
      robust(fresh("gnome:legendary")),
      "gnome:legendary",
      3,
      0,
    ).state;
    const coil = state.players[0]!.board.find(
      (u) => u.definition?.kind === "tesla",
    )!;
    expect(coil.depth).toBeGreaterThanOrEqual(1);
    put(state, 0, "guardian:common", 1, 0);
    put(state, 1, "guardian:common", 1, 0, { hp: 1, attack: 0 });
    const result = attack(state);
    expect(
      result.events.filter(
        (e) => e.cardId === coil.cardId && e.ability === "Dégâts magiques",
      ),
    ).toHaveLength(1);
  });
  it("summons Athena's plain archers into free neighboring cells on a credited kill", () => {
    const state = robust(fresh("fox:legendary"));
    put(state, 1, "guardian:common", 0, 0, { hp: 1, attack: 0 });
    const result = deploy(state, "fox:legendary", 0, 1).state;
    const tokens = result.players[0]!.board.filter((u) => u.definition);
    expect(tokens).toHaveLength(5);
    expect(
      tokens.every(
        (u) =>
          u.definition!.attack === 6 &&
          u.definition!.health === 3 &&
          u.definition!.abilities!.length === 0,
      ),
    ).toBe(true);
  });
  it("makes one full counterattack without ping-pong when both combatants can counter", () => {
    let state = deploy(robust(fresh("lynx:legendary")), "lynx:legendary").state;
    put(state, 1, "guardian:common", 0, 0, {
      hp: 100,
      maxHp: 100,
      attack: 3,
      counterAttack: true,
    });
    const result = attack(state, 1);
    expect(
      result.events.filter(
        (e) => e.type === "attack" && e.ability === "Contre-attaque",
      ),
    ).toHaveLength(1);
    expect(result.state.players[1]!.board[0]!.hp).toBe(84);
    expect(result.state.players[0]!.board[0]!.hp).toBe(13);
  });
  it("evades ranged damage, including its on-hit drain and poison, while retaining shields", () => {
    let state = deploy(
      robust(fresh("captain:legendary")),
      "captain:legendary",
    ).state;
    state.players[0]!.board[0]!.shield = true;
    put(state, 1, "fox:common", 0, 2, { vampirism: 10, poison: 10 });
    const result = attack(state, 1);
    expect(result.state.players[0]!.board[0]).toMatchObject({
      hp: 20,
      evasion: true,
      shield: true,
    });
    expect(result.state.players[0]!.board[0]!.poisoned).toBeUndefined();
    expect(result.events.some((e) => e.ability === "Esquive")).toBe(true);
  });
  it("blocks allied buffs and enemy magic with immunity while retaining intrinsic block", () => {
    let state = deploy(
      robust(fresh("stag:legendary", "bard:epic")),
      "stag:legendary",
    ).state;
    state = deploy(state, "bard:epic", 2, 2).state;
    const unit = state.players[0]!.board.find(
      (u) => u.cardId === "stag:legendary",
    )!;
    expect(unit).toMatchObject({ hp: 19, immune: true, block: 5 });
    expect(unit.attack).toBeUndefined();
    put(state, 1, "witch:legendary", 0, 2, { hp: 1, attack: 0 });
    const result = attack(state);
    expect(
      result.state.players[0]!.board.find((u) => u.cardId === unit.cardId)!.hp,
    ).toBe(19);
    expect(result.events.some((e) => e.ability === "Immunité")).toBe(true);
  });
  it("silences intrinsic skills and granted buffs on the struck enemy", () => {
    const state = robust(fresh("owl:legendary"));
    put(state, 1, "wolf:rare", 0, 0, {
      hp: 100,
      maxHp: 100,
      block: 2,
      spikes: 2,
      extraAttacks: 3,
      regeneration: 4,
    });
    const result = deploy(state, "owl:legendary").state;
    const victim = result.players[1]!.board[0]!;
    expect(victim.silenced).toBe(true);
    expect(victim.block).toBeUndefined();
    expect(victim.extraAttacks).toBeUndefined();
    expect(victim.regeneration).toBeUndefined();
    expect(
      playerView(result, "a").players[1]!.board[0]!.card.abilities,
    ).toEqual([]);
  });
  it("cleanses negative statuses without removing silence", () => {
    const state = robust(fresh("owl:legendary"));
    put(state, 0, "guardian:common", 0, 0, {
      poisoned: 3,
      attackCurse: 8,
      attackLimit: 1,
      attack: 0,
      silenced: true,
    });
    const result = deploy(state, "owl:legendary", 3, 2).state;
    const ally = result.players[0]!.board[0]!;
    expect(ally.silenced).toBe(true);
    expect(ally.poisoned).toBeUndefined();
    expect(ally.attackCurse).toBeUndefined();
    expect(ally.attackLimit).toBeUndefined();
    expect(unitAttack(ally, result.players[0]!)).toBe(3);
  });
  it("caps an appearing enemy's attack for its next action and restores the latest attack afterward", () => {
    const state = robust(fresh("wisp:legendary"));
    put(state, 0, "wisp:legendary", 3, 2);
    const result = deploy(state, "guardian:common", 0, 0, 1);
    expect(
      result.events.find(
        (e) => e.type === "attack" && e.cardId === "guardian:common",
      )!.damage,
    ).toBe(1);
    const unit = result.state.players[1]!.board[0]!;
    expect(unit.attackLimit).toBeUndefined();
    expect(unitAttack(unit, result.state.players[1]!)).toBe(3);
  });
  it("punishes an attack gain exactly once and lets purification remove the curse", () => {
    const state = robust(fresh("stag:legendary", "knight:epic"));
    put(state, 0, "stag:legendary", 0, 0, { immune: true, block: 5 });
    put(state, 1, "knight:epic", 3, 0);
    put(state, 1, "guardian:common", 1, 0, { hp: 20, maxHp: 20 });
    let next = attack(state).state;
    const result = attack(next, 1);
    const unit = result.state.players[1]!.board.find(
      (u) => u.cardId === "guardian:common",
    )!;
    expect(unit.attack).toBe(8);
    expect(unit.hp).toBe(12);
    expect(
      result.events.filter(
        (e) => e.ability === "Malédiction" && e.targetCardId === unit.cardId,
      ),
    ).toHaveLength(1);
  });
  it("reacts to any shield lost, including its own, and includes Apollo in his buffs", () => {
    const state = robust(fresh("bard:legendary"));
    put(state, 0, "bard:legendary", 3, 2);
    put(state, 0, "guardian:common", 0, 0);
    const result = deploy(state, "fox:common", 0, 2, 1).state;
    expect(result.players[0]!.board[0]).toMatchObject({
      shield: true,
      attack: 22,
    });
    expect(result.players[0]!.board[1]).toMatchObject({
      shield: false,
      attack: 13,
    });
  });
  it("applies poison to two distinct enemies and reacts to each poison tick", () => {
    const state = robust(fresh("mushroom:legendary"));
    put(state, 1, "guardian:common", 1, 0, { hp: 100, maxHp: 100, attack: 0 });
    put(state, 1, "turtle:common", 2, 0, { hp: 100, maxHp: 100, attack: 0 });
    const result = deploy(state, "mushroom:legendary", 3, 2);
    expect(
      result.state.players[1]!.board.every(
        (u) => u.poisoned === 6 && u.hp === 94,
      ),
    ).toBe(true);
    expect(
      result.events.filter(
        (e) => e.ability === "Dégâts magiques" && e.amount === -9,
      ),
    ).toHaveLength(2);
  });
  it("drains only actual remaining HP across targets at the start of its turn", () => {
    const state = robust(fresh("vampire:legendary"));
    put(state, 0, "vampire:legendary", 0, 0, { hp: 5 });
    put(state, 1, "guardian:common", 1, 0, { hp: 1, attack: 0 });
    put(state, 1, "turtle:common", 2, 0, { hp: 100, maxHp: 100, attack: 0 });
    const result = attack(state, 1).state;
    expect(result.players[0]!.board[0]!.hp).toBe(9);
    expect(result.players[1]!.board).toHaveLength(1);
    expect(result.players[1]!.board[0]!.hp).toBe(97);
  });
  it("increases the hero's current and maximum HP on an enemy death", () => {
    const state = fresh("dragon:legendary");
    put(state, 0, "dragon:legendary", 3, 2);
    put(state, 0, "guardian:common", 0, 0);
    put(state, 1, "guardian:common", 0, 0, { hp: 1, attack: 0 });
    const result = attack(state).state;
    expect(result.players[0]).toMatchObject({ heroHp: 39, heroMaxHp: 39 });
    expect(playerView(result, "a").players[0]!.heroMaxHp).toBe(39);
  });
  it("reacts to actual allied regeneration and includes Maeve in the attack buff", () => {
    const state = robust(fresh("dragon:legendary"));
    put(state, 0, "dragon:legendary", 3, 2);
    put(state, 0, "guardian:common", 0, 0, { hp: 4, regeneration: 2 });
    const result = attack(state, 1).state;
    expect(
      result.players[0]!.board.find((u) => u.cardId === "dragon:legendary")!
        .attack,
    ).toBe(18);
    expect(
      result.players[0]!.board.find((u) => u.cardId === "guardian:common")!
        .attack,
    ).toBe(7);
  });
});

describe("Legendary integration in complete battles", () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    "settles summons, shields and death chains in simulated battle %i",
    (seed) => {
      let n = seed;
      const rand = () => {
        n = (n * 1664525 + 1013904223) >>> 0;
        return n / 2 ** 32;
      };
      const ids = reference.cards.map((c) => `${baseFor(c.name).id}:legendary`);
      const deck = (offset: number) =>
        Array.from({ length: 8 }, (_, i) =>
          resolveCard(ids[(offset + i) % ids.length]!),
        );
      let state = createGame(
        [
          { userId: "a", name: "A", cards: deck(seed * 2) },
          { userId: "b", name: "B", cards: deck(seed * 2 + 7) },
        ],
        0,
        rand,
      );
      for (let turn = 0; turn < 150 && state.status === "active"; turn++) {
        const owner = state.players[state.activePlayer]!;
        const card = owner.hand
          .map((id) => owner.cards.find((c) => c.id === id)!)
          .find((c) => legalPlacements(c, owner.board).length > 0);
        const cell = card ? legalPlacements(card, owner.board)[0] : undefined;
        state =
          card && cell
            ? summon(
                state,
                state.activePlayer,
                card.id,
                cell.row,
                cell.depth,
                state.turn,
                turn,
                rand,
              ).state
            : endTurn(state, state.activePlayer, state.turn, turn, rand).state;
        for (const p of state.players) {
          expect(p.board.every((u) => u.hp > 0)).toBe(true);
          expect(new Set(p.board.map((u) => `${u.row}:${u.depth}`)).size).toBe(
            p.board.length,
          );
          expect(p.hand).toHaveLength(4);
        }
      }
      expect(state.status).toBe("finished");
    },
  );
});
