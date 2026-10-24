import { describe, expect, it } from "vitest";
import { CATALOG, resolveCard } from "./index";
import {
  SUMMON_PACKS,
  ACTIVE_SUMMON_PACKS,
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
    ["sylve", 0, "rare", 30],
    ["sylve", 0.819999, "rare", 30],
    ["sylve", 0.82, "epic", 20],
    ["sylve", 0.979999, "epic", 20],
    ["sylve", 0.98, "legendary", 10],
    ["sylve", 0.999999, "legendary", 10],
  ] as const)(
    "applies %s rarity boundary %s with the new league quantities",
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
          item.variantId.endsWith(":rare"),
        ),
      ).toBe(true);
      expect(
        summonLoot("ancients", 1, () => 0.5, trophies).filter((item) =>
          item.variantId.endsWith(":epic"),
        ).length === 3,
      ).toBe(true);
      for (const pack of ["sylve", "ancients"] as const) {
        expect(
          summonLoot(
            pack,
            1,
            () => (pack === "ancients" ? 0 : 0.99999),
            trophies,
          ).every((item) => item.variantId.endsWith(":legendary")),
        ).toBe(true);
      }
    }
  });

  it.each(SUMMON_PACKS)(
    "guarantees $guaranteedLegendaries legendaries for $id x10 using the correct quantities",
    (pack) => {
      const loot = summonLoot(
        pack.id,
        10,
        () => (pack.id === "ancients" ? 0.5 : 0),
        5800,
      );
      expect(loot).toHaveLength(50);
      const legendaries = loot.filter((item) =>
        item.variantId.endsWith(":legendary"),
      );
      expect(legendaries).toHaveLength(pack.guaranteedLegendaries);
      expect(
        legendaries.every(
          (item) =>
            (pack.id === "ancients"
              ? item.count >= 150 && item.count <= 159
              : pack.id === "sylve"
                ? item.count >= 25 && item.count <= 27
                : item.count === 1000) ||
            (pack.id === "divine" && item.count === 2000),
        ),
      ).toBe(true);
      expect(
        summonLoot(
          pack.id,
          10,
          () => (pack.id === "ancients" ? 0 : 0.999999),
          5800,
        ).every((item) => item.variantId.endsWith(":legendary")),
      ).toBe(true);
    },
  );

  it("retains the archived divine rewards while disabling that offer", () => {
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
    expect(ACTIVE_SUMMON_PACKS.map((pack) => pack.id)).toEqual([
      "sylve",
      "ancients",
    ]);
    expect(() => summonQuantity("sylve", "common", 0)).toThrow(
      "Rareté absente",
    );
    expect(summonQuantity("sylve", "rare", 6000)).toEqual({
      min: 66,
      max: 70,
    });
    expect(summonQuantity("ancients", "legendary", 2400)).toEqual({
      min: 70,
      max: 75,
    });
    expect(() => summonQuantity("ancients", "common")).toThrow();
  });

  it.each([
    [0, [30, 30], [20, 20], [10, 10]],
    [400, [32, 32], [22, 22], [10, 10]],
    [1800, [42, 44], [25, 26], [15, 15]],
    [2000, [43, 45], [26, 27], [15, 15]],
    [5200, [63, 67], [34, 38], [22, 23]],
    [5800, [66, 70], [35, 39], [25, 27]],
    [6000, [66, 70], [35, 39], [25, 27]],
  ] as const)(
    "maps the supplied Sylve table to the peak division at %s trophies and rolls both range endpoints",
    (trophies, rare, epic, legendary) => {
      for (const [rarity, range, roll] of [
        ["rare", rare, 0],
        ["epic", epic, 0.82],
        ["legendary", legendary, 0.98],
      ] as const) {
        expect(summonQuantity("sylve", rarity, trophies)).toEqual({
          min: range[0],
          max: range[1],
        });
        for (const endpoint of [0, 1] as const) {
          let call = 0;
          const loot = summonLoot(
            "sylve",
            1,
            () => (call++ % 3 === 0 ? roll : endpoint === 0 ? 0 : 0.999999),
            trophies,
          );
          expect(
            loot.every(
              (item) =>
                item.variantId.endsWith(`:${rarity}`) &&
                item.count === range[endpoint],
            ),
          ).toBe(true);
        }
      }
    },
  );

  it.each([1, 10] as const)(
    "guarantees two legendaries per Ancients round and limits boosted quantities to those stacks (x%s)",
    (count) => {
      const boosted = summonLoot("ancients", count, () => 0);
      const standard = summonLoot("ancients", count, () => 0.5);
      for (let round = 0; round < count; round++) {
        expect(
          boosted.slice(round * 5, round * 5 + 5).map((item) => item.count),
        ).toEqual([60, 60, 30, 30, 30]);
        const group = standard.slice(round * 5, round * 5 + 5);
        expect(
          group.filter((item) => item.variantId.endsWith(":legendary")),
        ).toHaveLength(2);
        expect(group.map((item) => item.count)).toEqual([
          32, 32, 112, 112, 112,
        ]);
      }
    },
  );

  it("uses the S1/S2 league table, a strict 50% boost boundary and 10% extra legendary rolls", () => {
    expect(summonQuantity("ancients", "epic", 0)).toEqual({
      min: 108,
      max: 115,
    });
    expect(summonQuantity("ancients", "legendary", 400)).toEqual({
      min: 34,
      max: 37,
    });
    expect(summonQuantity("ancients", "legendary", 400, 2)).toEqual({
      min: 68,
      max: 71,
    });
    expect(summonQuantity("ancients", "epic", 6000)).toEqual({
      min: 378,
      max: 421,
    });
    expect(summonQuantity("ancients", "legendary", 6000, 2)).toEqual({
      min: 300,
      max: 309,
    });
    const values = [
      0.499999, 0.999999, 0, 0.5, 0, 0, 0.099999, 0, 0, 0.1, 0, 0, 0.99, 0, 0,
    ];
    const loot = summonLoot("ancients", 1, () => values.shift()!);
    expect(loot.map((item) => item.variantId.split(":")[1])).toEqual([
      "legendary",
      "legendary",
      "legendary",
      "epic",
      "epic",
    ]);
    expect(loot.map((item) => item.count)).toEqual([63, 30, 30, 108, 108]);
  });

  it("includes the guaranteed slots in the advertised 46% legendary rate and boosts half of them", () => {
    let seed = 821;
    const random = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
    let legends = 0;
    let boosts = 0;
    const total = 5000;
    for (let index = 0; index < total; index++) {
      const loot = summonLoot("ancients", 1, random);
      legends += loot.filter((item) =>
        item.variantId.endsWith(":legendary"),
      ).length;
      boosts += loot.filter(
        (item) => item.variantId.endsWith(":legendary") && item.count >= 60,
      ).length;
    }
    expect(legends / (total * 5)).toBeCloseTo(0.46, 2);
    expect(boosts / (total * 2)).toBeCloseTo(0.5, 1);
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
    "uses the configured repeat prices for $id and caps successive repeats",
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
          cost: count === 10 ? pack.repeatTenPrices[0] : pack.repeatPrices[0],
        });
        let previousCost = baseCost;
        const expected =
          pack.id === "sylve"
            ? count === 1
              ? [139, 129, 129, 129]
              : [1149, 999, 999, 999]
            : pack.id === "ancients"
              ? count === 1
                ? [4749, 4499, 4499, 4499]
                : [39999, 34999, 34999, 34999]
              : Array(4).fill(
                  count === 10 ? pack.repeatTenPrices[0] : pack.repeatPrices[0],
                );
        for (const cost of expected) {
          const offer = summonOffer(pack.id, count, true, previousCost);
          expect(offer.cost).toBe(cost);
          previousCost = offer.cost;
        }
        expect(summonOffer(pack.id, count, false, previousCost).cost).toBe(
          baseCost,
        );
      }
    },
  );

  it("retains the original prices and can select every creature", () => {
    for (const [id, price, tenPrice] of [
      ["sylve", 149, 1299],
      ["ancients", 4999, 44999],
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
