import { describe, expect, it } from "vitest";
import reference from "../../../docs/references/mighty-party/common-cards.json";
import {
  CATALOG,
  MAX_CARD_LEVEL,
  HERO_HP,
  createGame,
  endTurn,
  summon,
  playerView,
  variantCard,
  unitAttack,
  type GameState,
  type Unit,
} from "./index";

const random = () => 0;
function fresh(levels: Record<string, number> = {}) {
  const ids = [
    ...new Set([...Object.keys(levels), "guardian", "turtle", "fox", "wisp"]),
  ].slice(0, 8);
  const cards = ids.map((id) => variantCard(id, "common", levels[id] ?? 1));
  return createGame(
    [
      { userId: "a", name: "A", cards },
      { userId: "b", name: "B", cards },
    ],
    0,
    random,
    { field: false },
  );
}
function put(
  state: GameState,
  player: number,
  id: string,
  row: number,
  depth: number,
  hp?: number,
): Unit {
  const card = state.players[player]!.cards.find(
    (c) => c.id === `${id}:common`,
  )!;
  const unit = { cardId: card.id, row, depth, hp: hp ?? card.health };
  state.players[player]!.board.push(unit);
  return unit;
}
function deploy(
  state: GameState,
  player: number,
  id: string,
  row: number,
  depth: number,
) {
  state.activePlayer = player;
  state.hasSummoned = false;
  const owner = state.players[player]!;
  owner.hand = [
    `${id}:common`,
    ...owner.hand.filter((c) => c !== `${id}:common`).slice(0, 3),
  ];
  return summon(
    state,
    player,
    `${id}:common`,
    row,
    depth,
    state.turn,
    0,
    random,
  );
}

describe("reference-backed cards", () => {
  it("reproduces all 572 common stat pairs and all 34 skill schedules from the collected reference", () => {
    expect(MAX_CARD_LEVEL).toBe(26);
    expect(new Set(CATALOG.map((c) => c.sourceHero)).size).toBe(22);
    for (const base of CATALOG) {
      const source = reference.cards.find((c) => c.name === base.sourceHero)!;
      for (const row of source.levels) {
        const card = variantCard(base.id, "common", row.level);
        expect([card.attack, card.health]).toEqual([row.attack, row.health]);
        expect(card.faction).toBe(source.faction);
        expect(card.combatType).toBe(source.combatType);
        source.skills.forEach((skill, i) => {
          const ability = card.abilities![i]!;
          expect(ability.unlockLevel).toBe(skill.unlockLevel);
          expect(ability.active).toBe(row.level >= skill.unlockLevel);
          if (!ability.active) return;
          const point = [...skill.progression]
            .reverse()
            .find((p) => p.level <= row.level)!;
          if ("value" in point) expect(ability.value).toBe(point.value);
          if ("summonLevel" in point)
            expect(ability.summon).toMatchObject({
              level: point.summonLevel,
              attack: point.attack,
              health: point.health,
            });
        });
      }
    }
  });
  it("unlocks an ability without adding stats at the source's exact milestones", () => {
    const before = variantCard("guardian", "common", 2);
    const after = variantCard("guardian", "common", 3);
    expect([before.attack, before.health]).toEqual([
      after.attack,
      after.health,
    ]);
    expect(before.abilities![0]!.active).toBe(false);
    expect(after.abilities![0]).toMatchObject({ active: true, value: 2 });
    expect(variantCard("owl", "common", 2).abilities![0]!.active).toBe(true);
    expect(variantCard("guardian", "common", 11).abilities![1]!.active).toBe(
      true,
    );
  });
});

describe("ability resolution", () => {
  it.each([0, 1, 2])(
    "deploys a building in column %i without making an attack",
    (depth) => {
      const state = fresh({ idol: 1 });
      const result = deploy(state, 0, "idol", 0, depth);
      expect(result.state.players[0]!.board[0]!.depth).toBe(depth);
      expect(result.state.players[1]!.heroHp).toBe(HERO_HP);
      expect(result.events.some((e) => e.type === "attack")).toBe(false);
    },
  );
  it("consumes one mental shield and lets the next attack kill the same instance", () => {
    let state = deploy(fresh({ lynx: 1 }), 0, "lynx", 0, 0).state;
    expect(state.players[0]!.board[0]!.shield).toBe(true);
    put(state, 1, "fox", 0, 1);
    put(state, 1, "fox", 0, 2);
    const before = structuredClone(state);
    const result = endTurn(state, 1, state.turn, 0, random);
    expect(
      result.events.filter((e) => e.type === "attack").map((e) => e.damage),
    ).toEqual([0, 2]);
    expect(result.state.players[0]!.board).toEqual([]);
    expect(state).toEqual(before);
  });
  it("retaliates with spikes before resolving the attacker's death", () => {
    const state = deploy(fresh(), 0, "turtle", 0, 0).state;
    put(state, 1, "fox", 0, 2);
    const result = endTurn(state, 1, state.turn, 0, random);
    expect(result.state.players[0]!.board[0]!.hp).toBe(11);
    expect(result.state.players[1]!.board).toEqual([]);
    expect(result.events.findIndex((e) => e.ability === "Épines")).toBeLessThan(
      result.events.findIndex((e) => e.type === "death"),
    );
  });
  it("reduces physical attack damage with the block unlocked at level three", () => {
    const state = deploy(fresh({ guardian: 3 }), 0, "guardian", 0, 0).state;
    put(state, 1, "fox", 0, 2);
    const result = endTurn(state, 1, state.turn, 0, random);
    expect(result.events.find((e) => e.type === "attack")!.damage).toBe(2);
    expect(result.state.players[0]!.board[0]).toMatchObject({
      hp: 7,
      block: 2,
    });
  });
  it("makes a second attack and retargets after the first victim dies", () => {
    const state = fresh({ wolf: 1 });
    put(state, 1, "guardian", 0, 0, 1);
    const result = deploy(state, 0, "wolf", 0, 0);
    const attacks = result.events.filter((e) => e.type === "attack");
    expect(attacks.map((e) => e.targetCardId ?? "hero")).toEqual([
      "guardian:common",
      "hero",
    ]);
    expect(result.state.players[1]!.heroHp).toBe(27);
  });
  it("deals additional vampirism damage and heals only that much, up to max HP", () => {
    const state = deploy(fresh({ vampire: 1 }), 0, "vampire", 0, 0).state;
    state.players[0]!.board[0]!.hp = 4;
    put(state, 1, "guardian", 0, 0);
    state.activePlayer = 0;
    const result = endTurn(state, 0, state.turn, 0, random);
    expect(result.state.players[1]!.board[0]!.hp).toBe(4);
    expect(result.state.players[0]!.board[0]!.hp).toBe(6);
  });
  it("heals the hero on deployment without exceeding its maximum", () => {
    const state = fresh({ healer: 1 });
    state.players[0]!.heroHp = 25;
    const result = deploy(state, 0, "healer", 0, 0);
    expect(result.state.players[0]!.heroHp).toBe(30);
    expect(result.events.find((e) => e.ability === "Soin")!.amount).toBe(5);
  });
  it("increases maximum and current HP, independently of healing", () => {
    const state = fresh({ mushroom: 1 });
    put(state, 0, "guardian", 0, 0, 3);
    const result = deploy(state, 0, "mushroom", 1, 2);
    expect(
      result.state.players[0]!.board.find(
        (u) => u.cardId === "guardian:common",
      ),
    ).toMatchObject({ hp: 4, maxHp: 9 });
    expect(
      playerView(result.state, "a").players[0]!.board[0]!.card.health,
    ).toBe(9);
  });
  it("regenerates at the next start of its owner's turn and caps at maximum HP", () => {
    const state = fresh();
    put(state, 0, "guardian", 0, 0, 7);
    const granted = deploy(state, 0, "wisp", 1, 2).state;
    expect(granted.players[0]!.board[0]!.regeneration).toBe(2);
    const result = endTurn(granted, 1, granted.turn, 0, random);
    expect(result.state.players[0]!.board[0]!.hp).toBe(8);
  });
  it("places a life rune on an empty cell and activates it once on a later deployment", () => {
    const state = deploy(
      fresh({ enchantress: 1 }),
      0,
      "enchantress",
      0,
      2,
    ).state;
    expect(state.players[0]!.runes).toEqual([{ row: 0, depth: 0, health: 2 }]);
    const result = deploy(state, 0, "guardian", 0, 0);
    expect(result.state.players[0]!.runes).toEqual([{ row: 0, depth: 0, health: 2, activated: true }]);
    expect(
      result.state.players[0]!.board.find(
        (u) => u.cardId === "guardian:common",
      ),
    ).toMatchObject({ hp: 10, maxHp: 10 });
  });
  it.each(["captain", "witch"])(
    "creates a %s reinforcement without adding it to the hand or deck",
    (id) => {
      const state = fresh({ [id]: 1 });
      const ids = state.players[0]!.cards.map((c) => c.id);
      const result = deploy(state, 0, id, 0, id === "captain" ? 0 : 2);
      const owner = result.state.players[0]!;
      const token = owner.board.find((u) => u.definition)!;
      expect(token.depth).toBe(1);
      expect(token.hp).toBe(id === "captain" ? 4 : 2);
      expect(owner.cards.map((c) => c.id)).toEqual(ids);
      expect(owner.hand).not.toContain(token.cardId);
      expect(
        playerView(result.state, "a").players[0]!.board.find(
          (u) => u.cardId === token.cardId,
        )!.card.name,
      ).toBe(id === "captain" ? "Éclaireur des braises" : "Rejeton des spores");
    },
  );
  it("skips a reinforcement when its required cell is occupied", () => {
    const state = fresh({ captain: 1 });
    put(state, 0, "fox", 0, 1);
    const result = deploy(state, 0, "captain", 0, 0);
    expect(result.state.players[0]!.board).toHaveLength(2);
    expect(result.state.players[0]!.board.some((u) => u.definition)).toBe(
      false,
    );
  });
  it("expires a one-turn Order attack bonus after the combat where it was granted", () => {
    const state = fresh({ stag: 2 });
    put(state, 0, "guardian", 0, 0);
    const result = deploy(state, 0, "stag", 1, 0);
    expect(result.state.players[1]!.heroHp).toBe(22);
    const guard = result.state.players[0]!.board[0]!;
    expect(unitAttack(guard, result.state.players[0]!)).toBe(3);
    expect(guard.temporaryAttack).toBeUndefined();
  });
  it("grows when a different Nature ally appears and stacks granted effects", () => {
    const state = fresh({ bear: 2 });
    put(state, 0, "bear", 0, 0);
    const result = deploy(state, 0, "wisp", 1, 2);
    expect(result.state.players[0]!.board[0]).toMatchObject({
      attack: 3,
      regeneration: 2,
    });
  });
  it("applies column start-of-turn support to allies in that column only", () => {
    const state = fresh({ owl: 6 });
    put(state, 0, "fox", 0, 2);
    put(state, 0, "fox", 1, 1);
    put(state, 0, "owl", 2, 2);
    state.activePlayer = 1;
    const result = endTurn(state, 1, state.turn, 0, random);
    expect(result.state.players[0]!.board[0]).toMatchObject({
      hp: 4,
      maxHp: 4,
    });
    expect(result.state.players[0]!.board[1]!.hp).toBe(1);
  });
  it("pierces other enemies in the target column even when the primary target dies", () => {
    const state = fresh({ fox: 6 });
    put(state, 1, "guardian", 0, 0);
    put(state, 1, "guardian", 1, 0);
    put(state, 1, "guardian", 2, 1);
    const result = deploy(state, 0, "fox", 0, 2);
    expect(
      result.state.players[1]!.board.find((u) => u.row === 0),
    ).toBeUndefined();
    expect(result.state.players[1]!.board.find((u) => u.row === 1)!.hp).toBe(6);
    expect(result.state.players[1]!.board.find((u) => u.row === 2)!.hp).toBe(8);
  });
  it("weakens all enemies without giving a building a normal attack", () => {
    const state = fresh({ tree: 1 });
    put(state, 1, "fox", 0, 2);
    put(state, 1, "guardian", 1, 0);
    const result = deploy(state, 0, "tree", 0, 2);
    expect(result.state.players[1]!.board.map((u) => u.attack)).toEqual([2, 1]);
    expect(result.state.players[1]!.heroHp).toBe(30);
  });
  it("fires death abilities once and buffs surviving allies", () => {
    const state = fresh({ enchantress: 6 });
    put(state, 0, "enchantress", 0, 1, 1);
    put(state, 0, "guardian", 2, 0);
    put(state, 1, "fox", 0, 2);
    state.activePlayer = 1;
    const result = endTurn(state, 1, state.turn, 0, random);
    expect(result.state.players[0]!.board).toHaveLength(1);
    expect(result.state.players[0]!.board[0]!.attack).toBe(5);
    expect(
      result.events.filter((e) => e.type === "death" && e.player === 0),
    ).toHaveLength(1);
  });
  it("heals once per allied normal attack on the enemy hero", () => {
    const state = fresh({ gnome: 1 });
    state.players[0]!.heroHp = 20;
    put(state, 0, "fox", 2, 2);
    const result = deploy(state, 0, "gnome", 0, 0);
    expect(result.state.players[0]!.heroHp).toBe(26);
  });
});
