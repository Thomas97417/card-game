import { describe, expect, it } from "vitest";
import reference from "../../../docs/references/mighty-party/common-cards.json";
import {
  CATALOG,
  DEFAULT_DECK,
  MAX_CARD_LEVEL,
  RARITIES,
  baseCardId,
  createGame,
  endTurn,
  legalPlacements,
  resolveCard,
  summon,
  validateDeck,
  variantCard,
  upgradeCost,
  upgradeGoldCost,
} from "./index";
import { CHEST_RULES, chestGold, chestLoot, rollChest } from "./progression";

function seeded(seed = 17) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

describe("variantes et progression", () => {
  it("requires duplicates and gold for each successive level", () => {
    for (const rarity of RARITIES)
      for (let level = 1; level < MAX_CARD_LEVEL; level++) {
        const target = reference.economy.byRarity[rarity][level]!;
        expect(upgradeCost(level, rarity)).toBe(target.soulsToReach);
        expect(upgradeGoldCost(level, rarity)).toBe(target.goldToReach);
      }
  });
  it("defines 88 independent identities, preserving zero attack for buildings", () => {
    const ids = new Set<string>();
    for (const base of CATALOG) {
      let attack = 0,
        health = 0;
      for (const rarity of RARITIES) {
        const card = variantCard(base.id, rarity);
        ids.add(card.id);
        expect(baseCardId(card)).toBe(base.id);
        if (card.combatType === "building") expect(card.attack).toBe(0);
        else expect(card.attack).toBeGreaterThan(attack);
        expect(card.health).toBeGreaterThan(health);
        attack = card.attack;
        health = card.health;
        const upgraded = resolveCard(card.id, MAX_CARD_LEVEL);
        expect(upgraded.id).toBe(card.id);
        expect(upgraded.rarity).toBe(rarity);
        if (card.combatType === "building") expect(upgraded.attack).toBe(0);
        else expect(upgraded.attack).toBeGreaterThan(card.attack);
        expect(upgraded.health).toBeGreaterThan(card.health);
      }
    }
    expect(ids.size).toBe(88);
    expect(() => resolveCard("fox:mythic")).toThrow();
    expect(() => resolveCard("fox:rare:2")).toThrow();
    expect(() => resolveCard("fox:rare", 27)).toThrow();
    expect(() => resolveCard("fox:rare", 1.5)).toThrow();
  });
  it("allows the same creature in distinct rarities but rejects a repeated variant", () => {
    const deck = [
      ...DEFAULT_DECK,
      "guardian:rare",
      "guardian:epic",
      "guardian:legendary",
    ];
    expect(validateDeck(deck)).toHaveLength(7);
    expect(() => validateDeck([...deck, "guardian:common"])).toThrow("unique");
  });
  it.each([4, 8])(
    "keeps four distinct hand variants and reusable cards throughout games with %i cards",
    (size) => {
      const random = seeded();
      const ids = [
        ...DEFAULT_DECK,
        "guardian:rare",
        "fox:epic",
        "owl:common",
        "wolf:legendary",
      ].slice(0, size);
      let state = createGame(
        [
          { userId: "a", name: "A", cards: validateDeck(ids) },
          { userId: "b", name: "B", cards: validateDeck(ids) },
        ],
        0,
        random,
        { field: false },
      );
      for (let i = 0; i < 250 && state.status === "active"; i++) {
        const player = state.players[state.activePlayer]!;
        const card = player.hand
          .map((id) => player.cards.find((card) => card.id === id)!)
          .find((card) => legalPlacements(card, player.board).length);
        const cell = card ? legalPlacements(card, player.board)[0]! : null;
        state =
          card && cell
            ? summon(
                state,
                state.activePlayer,
                card.id,
                cell.row,
                cell.depth,
                state.turn,
                i,
                random,
              ).state
            : endTurn(state, state.activePlayer, state.turn, i, random).state;
        for (const owner of state.players) {
          expect([...owner.hand, ...owner.drawPile].sort()).toEqual(
            [...ids].sort(),
          );
          expect(owner.cards.map((card) => card.id)).toEqual(ids);
          expect(owner.hand).toHaveLength(4);
          expect(new Set(owner.hand).size).toBe(4);
          expect(owner.board.every((unit) => ids.includes(unit.cardId))).toBe(
            true,
          );
        }
      }
      expect(state.status).toBe("finished");
    },
  );
});

describe("tirages des coffres", () => {
  it("uses the specified probability boundaries", () => {
    expect(
      [0, 0.64999, 0.65, 0.89999, 0.9, 0.97999, 0.98, 0.99999].map((value) =>
        rollChest(() => value),
      ),
    ).toEqual([
      "common",
      "common",
      "rare",
      "rare",
      "epic",
      "epic",
      "legendary",
      "legendary",
    ]);
  });
  it.each(RARITIES)(
    "gives gold and a larger single stack strictly matching a %s chest's rarity",
    (rarity) => {
      const random = seeded();
      for (let i = 0; i < 50; i++) {
        const loot = chestLoot(rarity, random);
        expect(loot).toHaveLength(1);
        const total = loot.reduce((sum, stack) => sum + stack.count, 0);
        expect(total).toBeGreaterThanOrEqual(CHEST_RULES[rarity].min);
        expect(total).toBeLessThanOrEqual(CHEST_RULES[rarity].max);
        expect(resolveCard(loot[0]!.variantId).rarity).toBe(rarity);
        const gold = chestGold(rarity, random);
        expect(Number.isInteger(gold)).toBe(true);
        expect(gold).toBeGreaterThanOrEqual(CHEST_RULES[rarity].minGold);
        expect(gold).toBeLessThanOrEqual(CHEST_RULES[rarity].maxGold);
        for (const stack of loot) {
          expect(Number.isInteger(stack.count)).toBe(true);
          expect(stack.count).toBeGreaterThan(0);
          expect(() => resolveCard(stack.variantId)).not.toThrow();
        }
      }
      expect(
        chestLoot(rarity, () => 0).reduce((sum, stack) => sum + stack.count, 0),
      ).toBe(CHEST_RULES[rarity].min);
      expect(
        chestLoot(rarity, () => 0.999999).reduce(
          (sum, stack) => sum + stack.count,
          0,
        ),
      ).toBe(CHEST_RULES[rarity].max);
      expect(chestGold(rarity, () => 0)).toBe(CHEST_RULES[rarity].minGold);
      expect(chestGold(rarity, () => 0.999999)).toBe(
        CHEST_RULES[rarity].maxGold,
      );
    },
  );
  it.each(RARITIES)("can select every monster from a %s chest", (rarity) => {
    const variants = CATALOG.map((_, index) => {
      const values = [0, (index + 0.5) / CATALOG.length];
      return chestLoot(rarity, () => values.shift()!)[0]!.variantId;
    });
    expect(variants).toEqual(CATALOG.map((card) => `${card.id}:${rarity}`));
  });
});
