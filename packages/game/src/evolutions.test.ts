import { describe, expect, it } from "vitest";
import reference from "../../../docs/references/mighty-party/evolution-cards.json";
import commonReference from "../../../docs/references/mighty-party/common-cards.json";
import {
  CATALOG,
  createGame,
  endTurn,
  summon,
  withdraw,
  resolveCard,
  variantCard,
  maxCardLevel,
  upgradeCost,
  upgradeGoldCost,
  playerView,
  unitAttack,
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
  );
  state.activePlayer = 0;
  return state;
}
function put(
  state: GameState,
  player: number,
  id: string,
  row: number,
  depth: number,
  extra: Partial<Unit> = {},
) {
  const owner = state.players[player]!;
  if (!owner.cards.some((c) => c.id === id)) owner.cards.push(resolveCard(id));
  const card = owner.cards.find((c) => c.id === id)!;
  const unit: Unit = { cardId: id, row, depth, hp: card.health, ...extra };
  owner.board.push(unit);
  return unit;
}
function deploy(state: GameState, id: string, row = 0, depth?: number) {
  const owner = state.players[0]!;
  const card = owner.cards.find((c) => c.id === id)!;
  owner.hand = [
    id,
    ...owner.cards
      .filter((c) => c.id !== id)
      .slice(0, 3)
      .map((c) => c.id),
  ];
  state.activePlayer = 0;
  state.hasSummoned = false;
  return summon(
    state,
    0,
    id,
    row,
    depth ?? (card.combatType === "ranged" ? 2 : 0),
    state.turn,
    0,
    random,
  );
}
function attack(state: GameState, player = 0) {
  state.activePlayer = player;
  return endTurn(state, player, state.turn, 0, random);
}

describe("documented Rare and Epic evolutions", () => {
  it("retains 22 reciprocal chains, all 1364 stat pairs and all 85 skill schedules", () => {
    expect(reference.chains).toHaveLength(22);
    expect(reference.cards).toHaveLength(44);
    expect(reference.cards.reduce((n, c) => n + c.skills.length, 0)).toBe(85);
    for (const chain of reference.chains) {
      const base = CATALOG.find((c) => c.sourceHero === chain.common)!;
      for (const rarity of ["rare", "epic"] as const) {
        const source = reference.cards.find((c) => c.name === chain[rarity])!;
        expect(source.evolvesFrom).toBe(
          rarity === "rare" ? chain.common : chain.rare,
        );
        expect(source.levels).toHaveLength(31);
        for (const row of source.levels) {
          const card = variantCard(base.id, rarity, row.level);
          expect([card.attack, card.health]).toEqual([row.attack, row.health]);
          expect(card.sourceHero).toBe(source.name);
          expect(card.combatType).toBe(source.combatType);
          expect(card.faction).toBe(source.faction);
          expect(card.gender).toBe(source.gender);
          expect(card.artId).toBe(`evolutions/${base.id}-${rarity}`);
          source.skills.forEach((skill, index) => {
            const ability = card.abilities![index]!;
            expect(ability.active).toBe(row.level >= skill.unlockLevel);
            expect(ability.unlockLevel).toBe(skill.unlockLevel);
            expect(ability.description).not.toMatch(/\{|undefined|NaN/);
            const point = [...skill.progression]
              .reverse()
              .find((p) => p.level <= row.level);
            if (point && "value" in point)
              expect(ability.value).toBe(point.value);
            if (point && "attack" in point)
              expect(ability.summon).toMatchObject({
                attack: point.attack,
                health: point.health,
                level: point.summonLevel,
              });
          });
          const economy =
            commonReference.economy.byRarity[rarity][row.level - 1]!;
          expect(row.cost).toEqual([economy.soulsToReach, economy.goldToReach]);
        }
      }
    }
  });
  it("uses exact early unlocks and per-rarity level ceilings", () => {
    expect(variantCard("stag", "rare", 3).abilities![0]!.active).toBe(false);
    expect(variantCard("stag", "rare", 4).abilities![0]).toMatchObject({
      active: true,
      value: 2,
    });
    expect(variantCard("bear", "rare", 1).abilities![0]!.active).toBe(false);
    expect(variantCard("bear", "rare", 2).abilities![0]).toMatchObject({
      active: true,
      value: 2,
    });
    expect(variantCard("guardian", "rare", 5).abilities![1]!.active).toBe(
      false,
    );
    expect(variantCard("guardian", "rare", 6).abilities![1]!.active).toBe(true);
    for (const rarity of ["rare", "epic"] as const) {
      expect(maxCardLevel(rarity)).toBe(31);
      expect(upgradeCost(30, rarity)).toBeGreaterThan(0);
      expect(upgradeGoldCost(30, rarity)).toBeGreaterThan(0);
      expect(upgradeCost(31, rarity)).toBe(0);
      expect(() => variantCard("guardian", rarity, 32)).toThrow();
    }
    for (const rarity of ["common", "legendary"] as const) {
      expect(maxCardLevel(rarity)).toBe(26);
      expect(() => variantCard("guardian", rarity, 27)).toThrow();
    }
  });
});

describe("evolution combat skills", () => {
  it("summons the sourced archer and two independent Epic tokens without changing the deck", () => {
    const rare = deploy(fresh("guardian:rare"), "guardian:rare").state;
    expect(
      rare.players[0]!.board.find((u) => u.definition)?.definition,
    ).toMatchObject({ attack: 6, health: 1, level: 2 });
    const state = fresh("captain:epic");
    const result = deploy(state, "captain:epic");
    const tokens = result.state.players[0]!.board.filter((u) => u.definition);
    expect(tokens.map((u) => u.depth)).toEqual([1, 2]);
    expect(
      tokens.every(
        (u) => u.definition!.attack === 6 && u.definition!.health === 2,
      ),
    ).toBe(true);
    expect(tokens.every((u) => u.definition!.abilities?.length === 0)).toBe(
      true,
    );
    expect(tokens.every((u) => u.definition!.gender === "female")).toBe(true);
    expect(result.state.players[0]!.cards).toEqual(state.players[0]!.cards);
    expect(
      result.state.players[0]!.hand.some((id) => id.startsWith("token-")),
    ).toBe(false);
  });
  it("grants vampirism to two distinct allies", () => {
    const state = fresh("serpent:rare");
    put(state, 0, "guardian:common", 1, 0);
    put(state, 0, "turtle:common", 2, 0);
    const result = deploy(state, "serpent:rare").state;
    expect(
      result.players[0]!.board.filter((u) => u.vampirism === 3),
    ).toHaveLength(2);
  });
  it("steals only available attack and preserves the transferred amount", () => {
    const state = fresh("vampire:rare");
    put(state, 0, "vampire:rare", 0, 0);
    put(state, 1, "guardian:common", 0, 0, { hp: 100, maxHp: 100, attack: 1 });
    const result = attack(state).state;
    expect(result.players[1]!.board[0]!.attack).toBe(0);
    expect(result.players[0]!.board[0]!.attack).toBe(
      resolveCard("vampire:rare").attack + 1,
    );
  });
  it("grants poison, applies it on attacks, ticks before regeneration and persists in views", () => {
    const state = fresh("mushroom:epic");
    put(state, 0, "mushroom:epic", 3, 2);
    put(state, 0, "guardian:common", 0, 0);
    let next = attack(state).state;
    const poisonedAttacker = next.players[0]!.board.find(
      (u) => u.cardId === "guardian:common",
    )!;
    expect(poisonedAttacker.poison).toBe(3);
    put(next, 1, "guardian:common", 0, 0, {
      hp: 100,
      maxHp: 100,
      regeneration: 1,
    });
    next = attack(next).state;
    const target = next.players[1]!.board[0]!;
    expect(target.poisoned).toBe(3);
    expect(target.hp).toBe(95); // 100 - physical 3 - poison 3 + regeneration 1
    expect(playerView(next, "a").players[1]!.board[0]!.poisoned).toBe(3);
  });
  it("reacts to actual block with attack and healing without restoring a lethal victim", () => {
    const state = fresh("fox:epic", "enchantress:epic");
    put(state, 0, "guardian:common", 0, 0, { attack: 4 });
    put(state, 1, "guardian:common", 0, 0, { block: 2, hp: 8 });
    put(state, 1, "fox:epic", 2, 2);
    put(state, 1, "enchantress:epic", 3, 2);
    const result = attack(state).state;
    expect(
      result.players[1]!.board.find((u) => u.cardId === "fox:epic")!.attack,
    ).toBe(resolveCard("fox:epic").attack + 3);
    expect(result.players[1]!.board[0]!.hp).toBe(8);
  });
  it("reacts to allied healing and vampirism", () => {
    const state = fresh("bard:rare", "serpent:epic");
    put(state, 0, "bard:rare", 2, 2);
    put(state, 0, "serpent:epic", 3, 2);
    put(state, 0, "guardian:common", 0, 0, { hp: 4, vampirism: 2 });
    put(state, 1, "turtle:common", 0, 0, { hp: 100, maxHp: 100 });
    const result = attack(state).state;
    expect(
      result.players[0]!.board.find((u) => u.cardId === "guardian:common")!
        .attack,
    ).toBe(4);
    expect(
      result.players[0]!.board.find((u) => u.cardId === "serpent:epic")!.attack,
    ).toBe(resolveCard("serpent:epic").attack + 3);
  });
  it("grants health to a newly appearing ally and shields survivors on allied death", () => {
    const state = fresh("owl:epic");
    put(state, 0, "owl:epic", 3, 2);
    let next = deploy(state, "guardian:common").state;
    expect(
      next.players[0]!.board.find((u) => u.cardId === "guardian:common")!.maxHp,
    ).toBe(13);
    put(next, 0, "turtle:common", 2, 0);
    put(next, 1, "guardian:common", 0, 0, { attack: 100 });
    next = attack(next, 1).state;
    expect(
      next.players[0]!.board.find((u) => u.cardId === "turtle:common")!.shield,
    ).toBe(true);
  });
  it("resolves full healing and cascading death damage once per dead instance", () => {
    const state = fresh("enchantress:rare", "idol:epic");
    put(state, 0, "enchantress:rare", 2, 2);
    put(state, 0, "idol:epic", 3, 2);
    put(state, 0, "guardian:common", 0, 0, { hp: 1 });
    put(state, 0, "turtle:common", 1, 0, { hp: 2 });
    put(state, 1, "guardian:common", 0, 0, { attack: 100 });
    const result = attack(state, 1);
    expect(
      result.state.players[0]!.board.find((u) => u.cardId === "turtle:common")!
        .hp,
    ).toBe(15);
    expect(result.events.filter((e) => e.type === "death")).toHaveLength(1);
    expect(
      result.events.filter((e) => e.ability === "Dégâts magiques"),
    ).toHaveLength(1);
  });
  it("grants extra attacks and retains them across turns", () => {
    const state = fresh("witch:epic");
    put(state, 0, "guardian:common", 0, 0);
    const result = deploy(state, "witch:epic", 3, 2);
    expect(
      result.state.players[0]!.board.find(
        (u) => u.cardId === "guardian:common",
      )!.extraAttacks,
    ).toBe(1);
    expect(
      result.events.filter(
        (e) => e.type === "attack" && e.cardId === "guardian:common",
      ),
    ).toHaveLength(2);
  });
  it("recalculates formation bonuses when an ally leaves and includes opposing adjacent units", () => {
    const state = fresh("lynx:epic", "wolf:epic", "bear:epic");
    put(state, 0, "guardian:common", 1, 1);
    let next = deploy(state, "lynx:epic", 0, 0).state;
    const lynx = next.players[0]!.board.find((u) => u.cardId === "lynx:epic")!;
    expect(lynx.formationHealth).toBe(4);
    expect(unitAttack(lynx, next.players[0]!)).toBe(
      resolveCard("lynx:epic").attack + 4,
    );
    next.activePlayer = 0;
    next = withdraw(next, 0, "guardian:common", next.turn, 0, {
      row: 1,
      depth: 1,
    }).state;
    expect(next.players[0]!.board[0]!.formationHealth).toBe(0);
    const other = fresh("bear:epic");
    const bear = put(other, 0, "bear:epic", 0, 0);
    put(other, 1, "guardian:common", 0, 0);
    expect(playerView(other, "a").players[0]!.board[0]!.card.attack).toBe(
      resolveCard("bear:epic").attack + 3,
    );
    expect(unitAttack(bear, other.players[0]!, other.players[1]!)).toBe(
      resolveCard("bear:epic").attack + 3,
    );
  });
  it("uses source gender for targeted buffs and death damage", () => {
    const state = fresh("knight:epic");
    put(state, 0, "guardian:common", 0, 0); // male Warrior
    put(state, 0, "fox:common", 1, 2); // female Archer
    const result = deploy(state, "knight:epic", 3, 0).state;
    expect(
      result.players[0]!.board.find((u) => u.cardId === "guardian:common")!
        .attack,
    ).toBe(8);
    expect(
      result.players[0]!.board.find((u) => u.cardId === "fox:common")!.attack,
    ).toBeUndefined();
  });
  it("creates attack runes and consumes them only on their own cell", () => {
    let state = deploy(
      fresh("enchantress:epic"),
      "enchantress:epic",
      3,
      2,
    ).state;
    const rune = state.players[0]!.runes![0]!;
    expect(rune).toMatchObject({ health: 0, attack: 4 });
    state = deploy(state, "guardian:common", rune.row, rune.depth).state;
    expect(state.players[0]!.runes).toEqual([]);
    expect(
      state.players[0]!.board.find((u) => u.cardId === "guardian:common")!
        .attack,
    ).toBe(7);
  });
  it("applies end-of-turn damage and resolves start-of-turn hero kills", () => {
    const state = fresh("tree:rare", "tree:epic");
    const tree = resolveCard("tree:rare", 6);
    state.players[0]!.cards = state.players[0]!.cards.map((c) =>
      c.id === tree.id ? tree : c,
    );
    put(state, 1, "guardian:common", 0, 0, { hp: 2 });
    const result = deploy(state, tree.id, 3, 2);
    expect(result.state.players[1]!.board).toHaveLength(0);
    const start = fresh("tree:epic");
    put(start, 1, "tree:epic", 3, 2);
    start.players[0]!.heroHp = 3;
    const ended = attack(start);
    expect(ended.state.status).toBe("finished");
    expect(ended.state.winner).toBe(1);
  });
  it.each([0, 4])(
    "heals Scarlet Warrior before a ranged attack only when the enemy can attack (%i power)",
    (power) => {
      const state = fresh("captain:epic");
      put(state, 0, "captain:epic", 3, 0, { hp: 1 });
      put(state, 1, "fox:common", 0, 2, { attack: power });
      const result = attack(state, 1).state;
      expect(result.players[0]!.board[0]!.hp).toBe(power > 0 ? 4 : 1);
    },
  );
  it("heals allies when their hero is physically attacked", () => {
    const state = fresh("fox:rare");
    put(state, 0, "guardian:common", 0, 0);
    put(state, 1, "fox:rare", 3, 2);
    put(state, 1, "guardian:common", 2, 0, { hp: 4 });
    const result = attack(state).state;
    expect(
      result.players[1]!.board.find((u) => u.cardId === "guardian:common")!.hp,
    ).toBe(6);
  });
  it("scales magical damage by allied blockers while excluding its own passive", () => {
    const state = fresh("guardian:epic");
    put(state, 0, "guardian:common", 1, 0, { block: 2 });
    put(state, 0, "turtle:common", 2, 0, { block: 1 });
    put(state, 1, "guardian:common", 0, 0, { hp: 100, maxHp: 100 });
    const result = deploy(state, "guardian:epic");
    expect(
      result.events.find((e) => e.ability === "Dégâts magiques")!.amount,
    ).toBe(-6);
    expect(
      result.state.players[0]!.board.find((u) => u.cardId === "guardian:epic")!
        .block,
    ).toBe(2);
  });
  it("targets a female enemy on death without damaging male enemies", () => {
    const state = fresh("bear:epic");
    put(state, 0, "bear:epic", 0, 0, { hp: 1 });
    put(state, 1, "guardian:common", 0, 0, {
      hp: 100,
      maxHp: 100,
      attack: 100,
    });
    put(state, 1, "fox:common", 1, 2, { hp: 100, maxHp: 100 });
    const result = attack(state, 1);
    expect(
      result.state.players[1]!.board.find((u) => u.cardId === "fox:common")!.hp,
    ).toBe(56);
    expect(
      result.state.players[1]!.board.find(
        (u) => u.cardId === "guardian:common",
      )!.hp,
    ).toBe(100);
  });
});
