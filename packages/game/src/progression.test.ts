import { describe, expect, it } from "vitest";
import reference from "../../../docs/references/cunt-wars/rules.json";
import chestReference from "../../../docs/references/cunt-wars/chests.json";
import {
  CATALOG,
  availableRarities,
  cardsOfRarity,
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
  upgradeExperience,
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
  it("uses the collected CW copies, gold and XP for each successive level", () => {
    for (const [index, rarity] of RARITIES.entries())
      for (let level = 1; level < maxCardLevel(rarity); level++) {
        const target = reference.Level_up_requirement.tables[index]!.rows.find(
          (row) => row[0] === String(level + 1),
        )!;
        expect(upgradeCost(level, rarity)).toBe(Number(target[2]));
        expect(upgradeGoldCost(level, rarity)).toBe(Number(target[1]));
        expect(upgradeExperience(level, rarity)).toBe(Number(target[4]));
      }
  });
  it("defines 84 CW identities, preserving zero attack for buildings", () => {
    const ids = new Set<string>();
    for (const base of CATALOG) {
      for (const rarity of availableRarities(base.id)) {
        const card = variantCard(base.id, rarity);
        ids.add(card.id);
        expect(baseCardId(card)).toBe(base.baseId);
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
    expect(ids.size).toBe(84);
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
    for (const trophies of [0, 800, 1000, 2000, 4000, 6000]) {
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
        "common",
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
  it("matches every collected PC-browser reward row independently of the runtime data", () => {
    const columns = {
      wooden: ["common", "rare", "epic"],
      common: ["common", "rare", "epic"],
      rare: ["rare", "epic"],
      bigRare: ["rare", "epic"],
      epic: ["epic", "legendary"],
      legendary: ["legendary"],
    } as const;
    const range = (value: string) => {
      const values = value.split(/\s*[-–]\s*/).map(Number);
      return { min: values[0], max: values[1] ?? values[0] };
    };
    for (const type of Object.keys(columns) as (keyof typeof columns)[]) {
      for (const row of chestReference.sources[type].tables[1]!.slice(1)) {
        const trophies = row[0] === "GM" ? 6000 : (30 - Number(row[0])) * 200;
        const rule = chestRules(type === "wooden" ? "common" : type, trophies);
        const gold = range(row[1]!);
        expect([rule.minGold, rule.maxGold]).toEqual([gold.min, gold.max]);
        for (const [index, rarity] of columns[type].entries())
          expect(rule.cards.find((card) => card.rarity === rarity)).toMatchObject(
            range(row[index + 2]!),
          );
      }
    }
  });
  it("uses CW quantities, rarity upgrades and opening rules at league thresholds", () => {
    expect(chestRules("rare", 1800)).toMatchObject({
      min: 27,
      max: 28,
      minGold: 65,
      maxGold: 91,
      durationMs: 10_800_000,
      instantCost: 33,
    });
    expect(chestRules("rare", 2000)).toMatchObject({
      min: 28,
      max: 29,
      durationMs: 10_800_000,
      instantCost: 33,
    });
    expect(chestRules("bigRare", 1000)).toMatchObject({
      min: 46,
      max: 48,
      minGold: 81,
      maxGold: 116,
      durationMs: 21_600_000,
      instantCost: 66,
    });
    expect(chestRules("bigRare", 2000)).toMatchObject({
      min: 56,
      max: 59,
      durationMs: 21_600_000,
      instantCost: 66,
    });
    expect(chestRules("legendary", 4000)).toMatchObject({
      min: 3,
      max: 3,
      minGold: 248,
      maxGold: 321,
      durationMs: 129_600_000,
      instantCost: 270,
    });
    expect(chestRules("bigRare", 6000)).toMatchObject({
      min: 118,
      max: 123,
      minGold: 210,
      maxGold: 252,
    });
    expect(chestRules("common", 0).durationMs).toBe(180_000);
    expect(chestRules("common", 999).durationMs).toBe(180_000);
    expect(chestRules("common", 1000).durationMs).toBe(3_600_000);
    expect(chestRules("common", 1200).durationMs).toBe(3_600_000);
    expect(chestRules("common", 1400).durationMs).toBe(3_600_000);
    for (const type of ["rare", "bigRare"] as const) {
      const values = [type === "rare" ? 0.995 : 0.99, 0, 0];
      expect(chestLoot(type, () => values.shift()!, 1800)[0]).toMatchObject({
        variantId: "guardian:epic",
        count: type === "rare" ? 6 : 10,
      });
      expect(chestLoot(type, () => 0.99999, 2000)[0]!.variantId).toMatch(
        /:epic$/,
      );
    }
    expect(chestLoot("common", () => 0, 2000)[0]).toEqual({
      variantId: "guardian:common",
      count: 28,
    });
    expect(chestRules("common", 0)).toMatchObject({
      min: 10, max: 11, minGold: 28, maxGold: 47,
    });
    expect(chestRules("common", 1000)).toMatchObject({
      min: 22, max: 23, minGold: 33, maxGold: 53,
    });
    expect(chestRules("common", 6000).cards.map(({ chance }) => chance)).toEqual([95, 4.75, 0.25]);
    expect(chestRules("rare", 2000).cards.map(({ chance }) => chance)).toEqual([95, 5]);
    expect(chestRules("epic", 2000).cards.map(({ chance }) => chance)).toEqual([99.75, 0.25]);
    for (const [type, trophies, chance, expected] of [
      ["common", 0, 0.95, "rare"],
      ["common", 0, 0.9975, "epic"],
      ["rare", 2000, 0.95, "epic"],
      ["bigRare", 2000, 0.95, "epic"],
      ["epic", 2000, 0.9975, "legendary"],
    ] as const) {
      const values = [chance, 0, 0];
      expect(resolveCard(chestLoot(type, () => values.shift()!, trophies)[0]!.variantId).rarity).toBe(expected);
    }
  });
  it("matches PC-browser opening times and prices at every league", () => {
    for (let trophies = 0; trophies <= 6000; trophies += 200) {
      for (const type of CHEST_TYPES) {
        const sourceType = type === "common" && trophies < 1000 ? "wooden" : type;
        const pc = chestReference.sources[sourceType].tables[0]!.find(
          (row) => row[0] === "PC",
        )!;
        const minutes = Number(pc[2]!.replace(/\D/g, "")) * (pc[2]!.includes("min") ? 1 : 60);
        const rule = chestRules(type, trophies);
        expect(rule).toMatchObject({
          durationMs: minutes * 60_000,
          instantCost: Number(pc[1]),
        });
        const chest = {
          rarity: type,
          awardedAt: 100,
          unlockAt: 100 + rule.durationMs,
          instantCost: rule.instantCost,
          leagueTrophies: trophies,
        };
        expect(chestRushCost(chest, 100)).toBe(Number(pc[1]));
        expect(chestRushCost(chest, 100 + rule.durationMs / 2)).toBe(Math.ceil(Number(pc[1]) / 2));
        expect(chestRushCost(chest, chest.unlockAt - 1)).toBe(1);
        expect(chestRushCost(chest, chest.unlockAt)).toBe(0);
      }
    }
  });
  it("uses a saved chest's original duration and price for its remaining cost", () => {
    const legacy = {
      rarity: "bigRare" as const,
      awardedAt: 100,
      unlockAt: 100 + 14_400_000,
      instantCost: 78,
      leagueTrophies: 2000,
    };
    expect(chestRushCost(legacy, 100)).toBe(78);
    expect(chestRushCost(legacy, 100 + 7_200_000)).toBe(39);
    expect(chestRushCost(legacy, legacy.unlockAt)).toBe(0);
  });
  it.each(CHEST_TYPES)(
    "allows every creature and charges only for the remaining time of %s",
    (type) => {
      const rarity =
        type === "common" ? "common" : type === "bigRare" ? "rare" : type;
      const pool = cardsOfRarity(rarity);
      for (const [index, base] of pool.entries()) {
        const values = [0, 0, (index + 0.5) / pool.length];
        expect(
          chestLoot(type, () => values.shift()!)[0]!.variantId.split(":")[0],
        ).toBe(base.baseId);
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
