import { describe, expect, it } from "vitest";
import { CATALOG, resolveCard } from "./index";
import {
  SUMMON_PACKS,
  summonGold,
  summonGoldQuantity,
  summonGoldRewards,
  summonLoot,
  summonPrice,
  summonOffer,
  summonQuantity,
} from "./summoning";

describe("invocations du sanctuaire", () => {
  it.each([
    ["sylve", 0, "common", 20],
    ["sylve", 0.649999, "common", 20],
    ["sylve", 0.65, "rare", 30],
    ["sylve", 0.899999, "rare", 30],
    ["sylve", 0.9, "epic", 20],
    ["sylve", 0.979999, "epic", 20],
    ["sylve", 0.98, "legendary", 10],
    ["sylve", 0.999999, "legendary", 10],
    ["ancients", 0, "epic", 20],
    ["ancients", 0.799999, "epic", 20],
    ["ancients", 0.8, "legendary", 10],
    ["ancients", 0.999999, "legendary", 10],
  ] as const)(
    "restores %s boundary %s with league quantities",
    (packId, roll, rarity, count) => {
      let call = 0;
      const loot = summonLoot(packId, 1, () => (call++ === 0 ? roll : 0));
      expect(loot).toHaveLength(5);
      expect(loot[0]).toEqual({
        variantId: `${CATALOG[0]!.id}:${rarity}`,
        count,
      });
    },
  );

  it("keeps the restored rarity rates in every league", () => {
    for (const trophies of [0, 2000, 6000]) {
      expect(
        summonLoot("sylve", 1, () => 0, trophies).every((item) =>
          item.variantId.endsWith(":common"),
        ),
      ).toBe(true);
      expect(
        summonLoot("ancients", 1, () => 0, trophies).every((item) =>
          item.variantId.endsWith(":epic"),
        ),
      ).toBe(true);
      for (const pack of ["sylve", "ancients"] as const) {
        expect(
          summonLoot(pack, 1, () => 0.99999, trophies).every((item) =>
            item.variantId.endsWith(":legendary"),
          ),
        ).toBe(true);
      }
    }
  });

  it.each(SUMMON_PACKS)(
    "guarantees $guaranteedLegendaries legendaries for $id x10 using the correct quantities",
    (pack) => {
      const loot = summonLoot(pack.id, 10, () => 0, 5800);
      expect(loot).toHaveLength(50);
      const legendaries = loot.filter((item) =>
        item.variantId.endsWith(":legendary"),
      );
      expect(legendaries).toHaveLength(pack.guaranteedLegendaries);
      expect(
        legendaries.every(
          (item) =>
            item.count === 1000 ||
            (pack.id === "divine" && item.count === 2000),
        ),
      ).toBe(true);
      expect(
        summonLoot(pack.id, 10, () => 0.999999, 5800).every((item) =>
          item.variantId.endsWith(":legendary"),
        ),
      ).toBe(true);
    },
  );

  it("moves the all-legendary pack and its double bonus to the much more expensive divine offer", () => {
    const doubled = summonLoot("divine", 10, () => 0, 6000);
    expect(doubled).toHaveLength(50);
    expect(doubled.every((item) => item.variantId.endsWith(":legendary"))).toBe(
      true,
    );
    for (let i = 0; i < 50; i += 5)
      expect(doubled.slice(i, i + 5).map((item) => item.count)).toEqual([
        2000, 1000, 1000, 1000, 1000,
      ]);
    expect(
      summonLoot("divine", 1, () => 0.5, 2000).map((item) => item.count),
    ).toEqual([30, 30, 30, 30, 30]);
    expect(summonOffer("sylve", 1, true).cost).toBe(139);
    expect(summonPrice("divine", 1)).toBe(4499);
    expect(summonPrice("divine", 10)).toBe(39999);
    expect(summonPrice("divine", 1)).toBeGreaterThan(
      summonPrice("ancients", 1) * 9,
    );
    expect(summonQuantity("sylve", "common", 0)).toEqual({ min: 20, max: 23 });
    expect(summonQuantity("sylve", "common", 6000)).toEqual({
      min: 1800,
      max: 1800,
    });
    expect(summonQuantity("sylve", "rare", 6000)).toEqual({
      min: 1400,
      max: 1400,
    });
    expect(summonQuantity("ancients", "legendary", 2400)).toEqual({
      min: 35,
      max: 35,
    });
    expect(() => summonQuantity("ancients", "common")).toThrow();
  });

  it("adds one gold card to every invocation without consuming a companion slot and scales it with peak league", () => {
    expect(summonGoldQuantity(0)).toEqual({ min: 500, max: 1000 });
    expect(summonGoldQuantity(6000)).toEqual({ min: 2000, max: 4000 });
    expect(summonGold("sylve", 1, () => 0)).toBe(500);
    expect(summonGold("sylve", 1, () => 0.999999)).toBe(1000);
    expect(summonGold("sylve", 10, () => 0)).toBe(5000);
    expect(summonGold("sylve", 10, () => 0.999999, 6000)).toBe(40000);
    for (const pack of ["ancients", "divine"] as const)
      expect(summonGold(pack, 10, () => 0.999999, 6000)).toBe(40000);
    let roll = 0;
    expect(summonGoldRewards("sylve", 10, () => roll++ / 10)).toEqual([
      500, 550, 600, 650, 700, 750, 800, 850, 900, 950,
    ]);
    expect(summonLoot("sylve", 1, () => 0)).toHaveLength(5);
    expect(summonLoot("sylve", 10, () => 0)).toHaveLength(50);
  });

  it.each(SUMMON_PACKS)(
    "uses the configured repeat prices for $id without stacking",
    (pack) => {
      for (const count of [1, 10] as const) {
        const baseCost = summonPrice(pack.id, count);
        expect(summonOffer(pack.id, count)).toEqual({
          packId: pack.id,
          count,
          baseCost,
          cost: baseCost,
        });
        expect(summonOffer(pack.id, count, true)).toEqual({
          packId: pack.id,
          count,
          baseCost,
          cost: count === 10 ? pack.repeatTenPrice : pack.repeatPrice,
        });
      }
    },
  );

  it("retains the original prices and can select every creature", () => {
    for (const [id, price, tenPrice] of [
      ["sylve", 149, 1299],
      ["ancients", 449, 3899],
    ] as const) {
      expect(summonPrice(id, 1)).toBe(price);
      expect(summonPrice(id, 10)).toBe(tenPrice);
    }
    for (const pack of SUMMON_PACKS)
      expect(Object.values(pack.rates).reduce((a, b) => a + b, 0)).toBe(100);
    for (const [index, base] of CATALOG.entries()) {
      const values = [0, 0, (index + 0.5) / CATALOG.length];
      expect(
        summonLoot("sylve", 1, () => values.shift() ?? 0)[0]!.variantId,
      ).toBe(`${base.id}:common`);
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
