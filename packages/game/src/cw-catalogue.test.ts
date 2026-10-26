import { describe, expect, it } from "vitest";
import raw from "../../../docs/references/cunt-wars/cards-raw.json";
import { variantCard as legacyCard } from "./test-fixtures/mighty-party/catalogue";
import {
  CARD_VARIANTS,
  CW_CATALOGUE,
  availableRarities,
  cardsOfRarity,
  resolveCard,
  variantCard,
  validateDeck,
  createGame,
  summon,
  endTurn,
  legalPlacements,
  type GameState,
  type Unit,
  canonicalVariantId,
} from "./index";

describe("CW catalogue from the collected wiki tables", () => {
  it("matches every one of the 2184 stat pairs against the independent source increments", () => {
    expect(CARD_VARIANTS).toHaveLength(84);
    expect(cardsOfRarity("common")).toHaveLength(18);
    const collected = raw as Record<
      string,
      { text: string; tables: { rows: string[][] }[] }
    >;
    for (const source of CW_CATALOGUE) {
      const page = collected[source.name]!;
      const initial = page.text.match(/Base Stats\nAttack\n(\d+)\nHP\n(\d+)/)!;
      let attack = Number(initial[1]),
        health = Number(initial[2]);
      const table = page.tables.find(
        (t) =>
          t.rows[0]?.join("|") === "Level|Attack|Health|Skill|Required league",
      )!;
      for (let level = 1; level <= 26; level++) {
        const card = variantCard(source.baseId, source.rarity, level);
        expect(
          [card.attack, card.health],
          `${source.name} level ${level}`,
        ).toEqual([attack, health]);
        expect(card.rarity).toBe(
          page.text.match(/\nRarity\n([^\n]+)/)![1]!.toLowerCase(),
        );
        if (level < 26) {
          attack += Number(table.rows[level]![1] || 0);
          health += Number(table.rows[level]![2] || 0);
        }
      }
      expect(() => variantCard(source.baseId, source.rarity, 27)).toThrow();
    }
  });
  it("retains variant identities and artwork paths while giving every family descriptive lore", () => {
    for (const card of CARD_VARIANTS) {
      const previous = legacyCard(card.baseId!, card.rarity!);
      expect(card.id).toBe(previous.id);
      expect(card.artId).toBe(previous.artId);
      expect(card.title.length).toBeGreaterThan(80);
      expect(card.title).not.toMatch(/^Évolution /);
      expect(card.faction).toBe(
        CW_CATALOGUE.find(
          (source) =>
            source.baseId === card.baseId && source.rarity === card.rarity,
        )!.faction,
      );
    }
    expect(resolveCard("owl:legendary").name).toBe("Souveraine du Saint-Siège");
    expect(resolveCard("owl:legendary").title).toContain("cathédrale");
    expect(resolveCard("mushroom:common").title).toContain("dryade");
    expect(resolveCard("wolf:rare").title).toContain("démoniaque");
  });
  it("uses actual CW rarities and families without creating missing common forms", () => {
    for (const id of ["wolf", "bard", "idol", "tree"]) {
      expect(availableRarities(id)).toEqual(["rare", "epic", "legendary"]);
      expect(() => variantCard(id, "common")).toThrow();
      expect(canonicalVariantId(`${id}:common`)).toBe(`${id}:rare`);
    }
    expect(resolveCard("wolf:rare").sourceHero).toBe("Red Orc");
    expect(resolveCard("wolf:epic").sourceHero).toBe("Orc Master");
    expect(resolveCard("wolf:legendary").sourceHero).toBe("Chieftain Orc");
    expect(resolveCard("wisp:rare").sourceHero).toBe("Karas");
    expect(resolveCard("wisp:epic").sourceHero).toBe("Forest Mage");
    expect(resolveCard("vampire:common").sourceHero).toBe("Nosferatu");
    expect(resolveCard("witch:legendary").sourceHero).toBe("Neyda");
    expect(() =>
      validateDeck([
        "wolf:common",
        "wolf:rare",
        "fox:common",
        "guardian:common",
      ]),
    ).toThrow("unique");
  });
  it("retains CW's early unlocks, new abilities and different initial values", () => {
    expect(resolveCard("guardian:common")).toMatchObject({
      attack: 3,
      health: 10,
    });
    expect(resolveCard("guardian:common").abilities![0]).toMatchObject({
      active: true,
      effect: "block",
      value: 2,
      unlockLevel: 1,
    });
    expect(resolveCard("owl:common", 2).abilities![0]).toMatchObject({
      active: true,
      value: 1,
      unlockLevel: 2,
    });
    expect(resolveCard("owl:common", 6).abilities![1]).toMatchObject({
      active: true,
      effect: "block",
      value: 1,
    });
    expect(resolveCard("dragon:common").abilities![0]).toMatchObject({
      effect: "regeneration",
      value: 2,
    });
    expect(resolveCard("witch:common").abilities).toHaveLength(1);
    expect(resolveCard("witch:common").abilities![0]).toMatchObject({
      effect: "attack",
      value: -1,
      target: "all_enemies",
    });
    expect(
      resolveCard("healer:common", 1).abilities!.every((a) => !a.active),
    ).toBe(true);
    expect(resolveCard("healer:common", 2).abilities![0]).toMatchObject({
      active: true,
      effect: "heal",
      value: 6,
    });
    expect(resolveCard("enchantress:common", 26).abilities![0]!.value).toBe(2);
    expect(resolveCard("tree:rare").combatType).toBe("melee");
    expect(resolveCard("idol:legendary").sourceHero).toBe("Vanakauri");
  });
});

const zero = () => 0;
function fresh(id: string): GameState {
  const cards = [
    id,
    ...["guardian:common", "turtle:common", "fox:common", "wisp:common"].filter(
      (x) => x !== id,
    ),
  ]
    .slice(0, 4)
    .map((id) => resolveCard(id));
  const state = createGame(
    [
      { userId: "a", name: "A", cards },
      { userId: "b", name: "B", cards },
    ],
    0,
    zero,
    { field: false },
  );
  state.activePlayer = 0;
  for (const p of state.players) {
    p.heroHp = 1000;
    p.heroMaxHp = 1000;
  }
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
  const unit = { cardId: id, row, depth, hp: 100, attack: 0, ...extra };
  owner.board.push(unit);
  return unit;
}
function deploy(state: GameState, id: string, row = 0, depth = 0) {
  const owner = state.players[0]!;
  owner.hand = [
    id,
    ...owner.cards
      .filter((c) => c.id !== id)
      .slice(0, 3)
      .map((c) => c.id),
  ];
  return summon(state, 0, id, row, depth, state.turn, 0, zero);
}

describe("CW combat behavior", () => {
  it("applies Witch weakness without inventing the previous zombie invocation", () => {
    const state = fresh("witch:common");
    put(state, 1, "guardian:common", 1, 0, { attack: 8 });
    const next = deploy(state, "witch:common", 0, 2).state;
    expect(next.players[1]!.board[0]!.attack).toBe(7);
    expect(next.players[0]!.board.some((u) => u.definition)).toBe(false);
  });
  it("splashes orthogonal neighbors even after a lethal hit, ignoring their Block", () => {
    const state = fresh("serpent:common");
    put(state, 1, "guardian:common", 0, 0, { hp: 1 });
    put(state, 1, "guardian:common", 1, 0, { hp: 10, block: 100 });
    const next = deploy(state, "serpent:common", 0, 2).state;
    expect(next.players[1]!.board).toHaveLength(1);
    expect(next.players[1]!.board[0]!.hp).toBe(8);
  });
  it("uses Scarlet Warrior's CW archers, including their initial Pierce", () => {
    const next = deploy(fresh("captain:epic"), "captain:epic").state;
    const tokens = next.players[0]!.board.filter((u) => u.definition);
    expect(tokens).toHaveLength(2);
    expect(tokens[0]!.definition).toMatchObject({
      attack: 6,
      health: 1,
      artId: "fox",
      rulesVersion: 2,
    });
    expect(tokens[0]!.definition!.abilities![0]).toMatchObject({
      effect: "pierce",
      value: 1,
    });
    expect("descriptionFr" in tokens[0]!.definition!.abilities![0]!).toBe(
      false,
    );
  });
  it("summons the CW healing minion and reuses an existing Sylve illustration", () => {
    const next = deploy(fresh("idol:epic"), "idol:epic").state;
    const token = next.players[0]!.board.find((u) => u.definition)!;
    expect(token.definition).toMatchObject({
      attack: 4,
      health: 2,
      artId: "mushroom",
      combatType: "ranged",
    });
    expect(token.definition!.abilities![0]).toMatchObject({
      effect: "heal",
      trigger: "turn_start",
      target: "random_ally",
      value: 2,
    });
  });
  it("reflects only actual damage received by Vanakauri to the opposing hero", () => {
    let state = deploy(fresh("idol:legendary"), "idol:legendary").state;
    const totem = state.players[0]!.board.find(
      (u) => u.cardId === "idol:legendary",
    )!;
    totem.block = 2;
    put(state, 1, "guardian:common", 0, 0, { attack: 7 });
    state = endTurn(state, 1, state.turn, 1, zero).state;
    expect(state.players[1]!.heroHp).toBe(995);
    expect(
      state.players[0]!.board.find((u) => u.cardId === "idol:legendary")!.hp,
    ).toBe(34);
  });
  it("D'Arc grants health before enemy attacks while retaining Immunity and Mental Shield", () => {
    const initial = fresh("stag:legendary");
    put(initial, 0, "guardian:common", 0, 0, { hp: 10, maxHp: 10 });
    let state = deploy(initial, "stag:legendary", 3, 0).state;
    put(state, 1, "guardian:common", 0, 0, { attack: 3 });
    state = endTurn(state, 1, state.turn, 1, zero).state;
    expect(
      state.players[0]!.board.find((u) => u.cardId === "guardian:common"),
    ).toMatchObject({ hp: 12, maxHp: 15 });
    expect(
      state.players[0]!.board.find((u) => u.cardId === "stag:legendary"),
    ).toMatchObject({ immune: true, shield: true });
  });
  it("creates cumulative CW pentagrams and keeps Aphrodite's marks in melee cells", () => {
    const state = deploy(
      fresh("enchantress:legendary"),
      "enchantress:legendary",
      3,
      2,
    ).state;
    expect(state.players[0]!.runes ?? []).toEqual([]);
    expect(state.players[0]!.pentagrams).toEqual([
      { row: 0, depth: 0, health: 8 },
    ]);
  });
  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    "settles mixed CW battles without illegal or duplicate positions (%i)",
    (seed) => {
      let n = seed;
      const random = () => {
        n = (n * 1664525 + 1013904223) >>> 0;
        return n / 2 ** 32;
      };
      const deck = (offset: number) =>
        Array.from(
          { length: 8 },
          (_, i) => CARD_VARIANTS[(offset + i * 7) % CARD_VARIANTS.length]!,
        );
      let state = createGame(
        [
          { userId: "a", name: "A", cards: deck(seed) },
          { userId: "b", name: "B", cards: deck(seed + 20) },
        ],
        0,
        random,
      );
      for (let turn = 0; turn < 100 && state.status === "active"; turn++) {
        const owner = state.players[state.activePlayer]!;
        const card = owner.hand
          .map((id) => owner.cards.find((c) => c.id === id)!)
          .find((c) => legalPlacements(c, owner.board).length);
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
                random,
              ).state
            : endTurn(state, state.activePlayer, state.turn, turn, random)
                .state;
        for (const player of state.players) {
          expect(
            player.board.every((u) => u.hp > 0 && Number.isFinite(u.hp)),
          ).toBe(true);
          expect(
            new Set(player.board.map((u) => `${u.row}:${u.depth}`)).size,
          ).toBe(player.board.length);
          expect(player.hand).toHaveLength(4);
        }
      }
    },
  );
});
