import { describe, expect, it } from "vitest";
import { CATALOG, resolveCard } from "./index";
import { SUMMON_PACKS, summonLoot, summonPrice } from "./summoning";

describe("invocations du sanctuaire", () => {
  it.each([
    ["sylve", 0, "common"],
    ["sylve", 0.649999, "common"],
    ["sylve", 0.65, "rare"],
    ["sylve", 0.899999, "rare"],
    ["sylve", 0.9, "epic"],
    ["sylve", 0.979999, "epic"],
    ["sylve", 0.98, "legendary"],
    ["sylve", 0.999999, "legendary"],
    ["ancients", 0, "epic"],
    ["ancients", 0.799999, "epic"],
    ["ancients", 0.8, "legendary"],
    ["ancients", 0.999999, "legendary"],
  ] as const)(
    "respects every boundary: %s at %s yields %s",
    (id, roll, rarity) => {
      let index = 0;
      const [loot] = summonLoot(id, 1, () => (index++ === 0 ? roll : 0));
      expect(loot).toEqual({
        variantId: `${CATALOG[0]!.id}:${rarity}`,
        count: 1,
      });
    },
  );

  it.each(SUMMON_PACKS)(
    "guarantees the minimum for $id even when all natural rolls miss",
    (pack) => {
      const loot = summonLoot(pack.id, 10, () => 0);
      expect(loot).toHaveLength(10);
      expect(
        loot.filter((entry) => entry.variantId.endsWith(":legendary")),
      ).toHaveLength(pack.guaranteedLegendaries);
      expect(loot.every((entry) => entry.count === 1)).toBe(true);
      if (pack.id === "ancients")
        expect(
          loot.every((entry) => /:(epic|legendary)$/.test(entry.variantId)),
        ).toBe(true);
    },
  );

  it.each(SUMMON_PACKS)(
    "keeps natural legendary rolls above the guarantee for $id",
    (pack) => {
      expect(
        summonLoot(pack.id, 10, () => 0.999).every((entry) =>
          entry.variantId.endsWith(":legendary"),
        ),
      ).toBe(true);
      expect(summonPrice(pack.id, 1)).toBe(pack.id === "sylve" ? 149 : 449);
      expect(summonPrice(pack.id, 10)).toBe(
        pack.id === "sylve" ? 1_299 : 3_899,
      );
      expect(
        Object.values(pack.rates).reduce((sum, rate) => sum + rate, 0),
      ).toBe(100);
    },
  );

  it("allows every creature and produces only valid variants over many guaranteed batches", () => {
    for (const [index, base] of CATALOG.entries()) {
      let call = 0;
      expect(
        summonLoot("sylve", 1, () =>
          call++ === 0 ? 0 : (index + 0.5) / CATALOG.length,
        )[0]!.variantId,
      ).toBe(`${base.id}:common`);
    }
    let seed = 42;
    const random = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
    for (const pack of SUMMON_PACKS) {
      for (let i = 0; i < 200; i++) {
        const loot = summonLoot(pack.id, 10, random);
        expect(
          loot.filter((entry) => entry.variantId.endsWith(":legendary")).length,
        ).toBeGreaterThanOrEqual(pack.guaranteedLegendaries);
        for (const item of loot)
          expect(() => resolveCard(item.variantId)).not.toThrow();
      }
    }
  });
});
