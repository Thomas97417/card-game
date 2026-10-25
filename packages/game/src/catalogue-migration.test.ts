import { describe, expect, it } from "vitest";
import reference from "./test-fixtures/mighty-party/common-reference.json";
import { catalogueMigration } from "./catalogue-migration";

describe("historical upgrade refunds", () => {
  it("refunds every removed level at the independently collected price for each rarity", () => {
    for (const rarity of ["rare", "epic", "legendary"] as const)
      for (let level = 27; level <= 31; level++) {
        const spent = reference.economy.byRarity[rarity].slice(26, level);
        const expectedCopies = spent.reduce(
          (sum, row) => sum + row.soulsToReach,
          0,
        );
        const expectedGold = spent.reduce(
          (sum, row) => sum + row.goldToReach,
          0,
        );
        const result = catalogueMigration([
          { variantId: `guardian:${rarity}`, level, copies: 7 },
        ]);
        expect(result.cards[0]).toMatchObject({
          level: 26,
          copies: 7 + expectedCopies,
        });
        expect(result.goldRefund).toBe(expectedGold);
        const repeated = catalogueMigration(result.cards);
        expect(repeated.cards[0]!.copies).toBe(7 + expectedCopies);
        expect(repeated.goldRefund).toBe(0);
      }
  });

  it("reimburses absorbed common upgrades and their acquisition in all four removed forms", () => {
    const spent = reference.economy.byRarity.common.slice(1, 5);
    const copies = spent.reduce((sum, row) => sum + row.soulsToReach, 0);
    const gold = spent.reduce((sum, row) => sum + row.goldToReach, 0);
    for (const family of ["wolf", "bard", "idol", "tree"]) {
      const result = catalogueMigration([
        { variantId: `${family}:common`, level: 5, copies: 7 },
        { variantId: `${family}:rare`, level: 9, copies: 11 },
      ]);
      expect(result.cards).toHaveLength(1);
      expect(result.cards[0]).toMatchObject({
        variantId: `${family}:rare`,
        level: 9,
        copies: 7 + 11 + copies + 1,
      });
      expect(result.goldRefund).toBe(gold);
    }
  });
});
