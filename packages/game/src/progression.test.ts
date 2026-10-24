import { describe, expect, it } from "vitest";
import reference from "../../../docs/references/mighty-party/common-cards.json";
import {
  CATALOG,
  DEFAULT_DECK,
  maxCardLevel,
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
import {
  CHEST_TYPES,
  chestRules,
  chestRushCost,
  chestPool,
  CHEST_SLOT_UNLOCKS,
  chestGold,
  chestLoot,
  rollChest,
  unlockedChestSlots,
} from "./progression";

function seeded(seed = 17) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

describe("variantes et progression", () => {
  it("starts with two slots, grants three league unlocks at their milestones and validates paid slots", () => {
    expect(unlockedChestSlots()).toEqual([0, 1]);
    for (const unlock of CHEST_SLOT_UNLOCKS) {
      expect(unlockedChestSlots(unlock.trophies - 1)).not.toContain(
        unlock.slot,
      );
      expect(unlockedChestSlots(unlock.trophies)).toContain(unlock.slot);
    }
    expect(unlockedChestSlots(0, [-1, 2, 4, 6, 6, 9])).toEqual([0, 1, 6]);
    expect(unlockedChestSlots(2400, [5, 6, 7])).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
    expect(unlockedChestSlots(Number.NaN)).toEqual([0, 1]);
  });
  it("requires duplicates and gold for each successive level", () => {
    for (const rarity of RARITIES)
      for (let level = 1; level < maxCardLevel(rarity); level++) {
        const target = reference.economy.byRarity[rarity][level]!;
        expect(upgradeCost(level, rarity)).toBe(target.soulsToReach);
        expect(upgradeGoldCost(level, rarity)).toBe(target.goldToReach);
      }
  });
  it("defines 88 independent identities, preserving zero attack for buildings", () => {
    const ids = new Set<string>();
    for (const base of CATALOG) {
      for (const rarity of RARITIES) {
        const card = variantCard(base.id, rarity);
        ids.add(card.id);
        expect(baseCardId(card)).toBe(base.id);
        if (card.combatType === "building") expect(card.attack).toBe(0);
        else expect(card.attack).toBeGreaterThan(0);
        expect(card.health).toBeGreaterThan(0);
        const upgraded = resolveCard(card.id, maxCardLevel(rarity, base.id));
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
    expect(() => resolveCard("fox:rare", 32)).toThrow();
    expect(() => resolveCard("fox:common", 27)).toThrow();
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
          expect(
            owner.board.every(
              (unit) => ids.includes(unit.cardId) || !!unit.definition,
            ),
          ).toBe(true);
        }
      }
      expect(state.status).toBe("finished");
    },
  );
});

describe("tirages des coffres", () => {
  it("exhausts each finite pool before refilling it", () => {
    for (const trophies of [0, 2000, 2200, 6000]) {
      const initial = chestPool(trophies);
      const remaining = { ...initial };
      const drawn = Object.fromEntries(
        CHEST_TYPES.map((type) => [type, 0]),
      ) as typeof initial;
      const random = seeded();
      for (
        let i = 0;
        i < Object.values(initial).reduce((a, b) => a + b, 0);
        i++
      ) {
        const type = rollChest(random, trophies, remaining);
        expect(remaining[type]).toBeGreaterThan(0);
        remaining[type]--;
        drawn[type]++;
      }
      expect(drawn).toEqual(initial);
      expect(rollChest(() => 0, trophies, remaining)).toBe(
        trophies < 2000 ? "common" : "rare",
      );
    }
  });
  it.each(CHEST_TYPES)(
    "gives valid card stacks and gold at every league for %s",
    (type) => {
      const random = seeded();
      for (let trophies = 0; trophies <= 6000; trophies += 200) {
        const rule = chestRules(type, trophies);
        expect(rule.cards.reduce((sum, card) => sum + card.chance, 0)).toBe(
          100,
        );
        for (let i = 0; i < 20; i++) {
          const [stack] = chestLoot(type, random, trophies);
          const card = rule.cards.find(
            (card) => card.rarity === resolveCard(stack!.variantId).rarity,
          )!;
          expect(card).toBeDefined();
          expect(stack!.count).toBeGreaterThanOrEqual(card.min);
          expect(stack!.count).toBeLessThanOrEqual(card.max);
          const gold = chestGold(type, random, trophies);
          expect(gold).toBeGreaterThanOrEqual(rule.minGold);
          expect(gold).toBeLessThanOrEqual(rule.maxGold);
        }
      }
    },
  );
  it("uses exact wiki quantities, gold, timers and epic bonuses at league thresholds", () => {
    expect(chestRules("rare", 1800)).toMatchObject({
      min: 72,
      max: 78,
      minGold: 174,
      maxGold: 254,
      durationMs: 10_800_000,
      instantCost: 30,
    });
    expect(chestRules("rare", 2000)).toMatchObject({
      min: 76,
      max: 79,
      durationMs: 7_200_000,
      instantCost: 39,
    });
    expect(chestRules("bigRare", 1000)).toMatchObject({
      min: 116,
      max: 119,
      minGold: 219,
      maxGold: 328,
      durationMs: 21_600_000,
      instantCost: 59,
    });
    expect(chestRules("bigRare", 2000)).toMatchObject({
      min: 152,
      max: 158,
      durationMs: 14_400_000,
      instantCost: 78,
    });
    expect(chestRules("legendary", 2200)).toMatchObject({
      min: 22,
      max: 26,
      minGold: 364,
      maxGold: 506,
      durationMs: 43_200_000,
      instantCost: 179,
    });
    expect(chestRules("bigRare", 6000)).toMatchObject({
      min: 2800,
      max: 2800,
      minGold: 792,
      maxGold: 923,
    });
    expect(chestRules("common", 0).durationMs).toBe(1_800_000);
    expect(chestRules("common", 1200).durationMs).toBe(2_700_000);
    expect(chestRules("common", 1400).durationMs).toBe(3_600_000);
    for (const type of ["rare", "bigRare"] as const) {
      const values = [type === "rare" ? 0.995 : 0.99, 0, 0];
      expect(chestLoot(type, () => values.shift()!, 1800)[0]).toMatchObject({
        variantId: "guardian:epic",
        count: type === "rare" ? 17 : 33,
      });
      expect(chestLoot(type, () => 0.99999, 2000)[0]!.variantId).toMatch(
        /:rare$/,
      );
    }
    expect(chestLoot("common", () => 0, 2000)[0]).toEqual({
      variantId: "guardian:rare",
      count: 76,
    });
  });
  it.each(CHEST_TYPES)(
    "allows every creature and charges only for the remaining time of %s",
    (type) => {
      for (const [index, base] of CATALOG.entries()) {
        const values = [0, 0, (index + 0.5) / CATALOG.length];
        expect(
          chestLoot(type, () => values.shift()!)[0]!.variantId.split(":")[0],
        ).toBe(base.id);
      }
      const rule = chestRules(type, 2200);
      const chest = {
        rarity: type,
        awardedAt: 100,
        unlockAt: 100 + rule.durationMs,
        instantCost: rule.instantCost,
        leagueTrophies: 2200,
      };
      expect(chestRushCost(chest, 0)).toBe(rule.instantCost);
      expect(chestRushCost(chest, 100)).toBe(rule.instantCost);
      expect(chestRushCost(chest, 100 + rule.durationMs / 2)).toBe(
        Math.ceil(rule.instantCost / 2),
      );
      expect(chestRushCost(chest, chest.unlockAt - 1)).toBe(1);
      expect(chestRushCost(chest, chest.unlockAt)).toBe(0);
      expect(chestRushCost(chest, chest.unlockAt + 1)).toBe(0);
    },
  );
});
