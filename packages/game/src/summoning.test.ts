import { describe, expect, it } from "vitest";
import { CATALOG, resolveCard } from "./index";
import {
  SUMMON_PACKS,
  summonLoot,
  summonPrice,
  summonQuantity,
} from "./summoning";

describe("invocations du sanctuaire", () => {
  it.each([
    [0, "rare", 30],
    [0.819999, "rare", 30],
    [0.82, "epic", 20],
    [0.979999, "epic", 20],
    [0.98, "legendary", 10],
    [0.999999, "legendary", 10],
  ] as const)(
    "uses Demigods boundary %s and league 30 quantities",
    (roll, rarity, count) => {
      let call = 0;
      const loot = summonLoot("sylve", 1, () => (call++ === 0 ? roll : 0));
      expect(loot).toHaveLength(5);
      expect(loot[0]).toEqual({
        variantId: `${CATALOG[0]!.id}:${rarity}`,
        count,
      });
    },
  );

  it("guarantees four rares in advanced single summons, with the fifth using 10/80/10 rates", () => {
    for (const [roll, rarity] of [
      [0, "rare"],
      [0.1, "epic"],
      [0.9, "legendary"],
    ] as const) {
      const loot = summonLoot("sylve", 1, () => roll, 2000);
      expect(
        loot
          .slice(0, 4)
          .every(
            (item) => item.variantId.endsWith(":rare") && item.count === 75,
          ),
      ).toBe(true);
      expect(loot[4]!.variantId).toMatch(new RegExp(`:${rarity}$`));
    }
  });

  it("grants exactly one legendary among fifty for Demigods x10, using the legendary quantity", () => {
    for (const roll of [0, 0.5, 0.999999]) {
      const loot = summonLoot("sylve", 10, () => roll, 5800);
      expect(loot).toHaveLength(50);
      const legendary = loot.filter((item) =>
        item.variantId.endsWith(":legendary"),
      );
      expect(legendary).toHaveLength(1);
      expect(legendary[0]!.count).toBe(1000);
      expect(
        loot.every((item) => /:(rare|epic|legendary)$/.test(item.variantId)),
      ).toBe(true);
    }
  });

  it("uses Gods of War quantities and doubles at most one hero in each group of five", () => {
    const doubled = summonLoot("ancients", 10, () => 0, 6000);
    expect(doubled).toHaveLength(50);
    expect(doubled.every((item) => item.variantId.endsWith(":legendary"))).toBe(
      true,
    );
    for (let i = 0; i < 50; i += 5)
      expect(doubled.slice(i, i + 5).map((item) => item.count)).toEqual([
        2000, 1000, 1000, 1000, 1000,
      ]);
    expect(
      summonLoot("ancients", 1, () => 0.5, 2000).map((item) => item.count),
    ).toEqual([30, 30, 30, 30, 30]);
    expect(summonQuantity("sylve", "rare", 0)).toEqual({ min: 30, max: 40 });
    expect(summonQuantity("sylve", "rare", 6000)).toEqual({
      min: 1400,
      max: 1400,
    });
    expect(summonQuantity("ancients", "legendary", 2400)).toEqual({
      min: 35,
      max: 35,
    });
    expect(() => summonQuantity("sylve", "common")).toThrow();
  });

  it("keeps prices and balanced rates, and can select every creature", () => {
    for (const pack of SUMMON_PACKS) {
      expect(summonPrice(pack.id, 1)).toBe(pack.id === "sylve" ? 149 : 449);
      expect(summonPrice(pack.id, 10)).toBe(pack.id === "sylve" ? 1299 : 3899);
      expect(Object.values(pack.rates).reduce((a, b) => a + b, 0)).toBe(100);
    }
    for (const [index, base] of CATALOG.entries()) {
      const values = [0, 0, (index + 0.5) / CATALOG.length];
      expect(
        summonLoot("sylve", 1, () => values.shift() ?? 0)[0]!.variantId,
      ).toBe(`${base.id}:rare`);
    }
    let seed = 42;
    const random = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
    for (const pack of SUMMON_PACKS)
      for (let i = 0; i < 50; i++) {
        const loot = summonLoot(pack.id, 10, random, (i % 31) * 200);
        for (const item of loot) {
          expect(() => resolveCard(item.variantId)).not.toThrow();
          expect(Number.isInteger(item.count) && item.count > 0).toBe(true);
        }
      }
  });
});
