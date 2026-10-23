import { describe, expect, it } from "vitest";
import { RARITIES } from "./index";
import {
  DECK_SLOT_UNLOCKS,
  LEAGUES,
  deckCapacity,
  leagueAt,
  leagueProgress,
} from "./leagues";
import { CHEST_RULES, chestGold, chestLoot, rollChest } from "./progression";

describe("league progression", () => {
  it("starts at Iron IV, promotes on exact thresholds and ends at Challenger I", () => {
    expect(leagueProgress(0)).toMatchObject({
      trophies: 0,
      current: { label: "Fer IV" },
      deckCapacity: 4,
      earned: 0,
    });
    for (const league of LEAGUES) {
      expect(leagueAt(league.minTrophies)).toBe(league);
      if (league.index)
        expect(leagueAt(league.minTrophies - 1).index).toBe(league.index - 1);
    }
    expect(leagueAt(199).label).toBe("Fer IV");
    expect(leagueAt(200).label).toBe("Fer III");
    expect(leagueAt(800).label).toBe("Bronze IV");
    expect(leagueProgress(999_999)).toMatchObject({
      current: { label: "Challenger I" },
      next: null,
      earned: 200,
    });
    expect(leagueProgress(-1).trophies).toBe(0);
    expect(leagueProgress(NaN).current.label).toBe("Fer IV");
  });

  it("unlocks exactly one of the four additional deck slots at each milestone", () => {
    expect(deckCapacity(0)).toBe(4);
    for (const unlock of DECK_SLOT_UNLOCKS) {
      expect(deckCapacity(unlock.trophies - 1)).toBe(unlock.slot - 1);
      expect(deckCapacity(unlock.trophies)).toBe(unlock.slot);
      expect(leagueProgress(unlock.trophies).nextSlot?.slot ?? 9).toBe(
        unlock.slot + 1,
      );
    }
    expect(deckCapacity(100_000)).toBe(8);
  });

  it("keeps earned deck slots through demotion while current league and loot follow the trophy total", () => {
    expect(leagueProgress(185, 200)).toMatchObject({
      current: { label: "Fer IV", lootMultiplier: 1 },
      peakTrophies: 200,
      deckCapacity: 5,
      nextSlot: { trophies: 800 },
    });
    expect(leagueProgress(0, 2400)).toMatchObject({
      current: { label: "Fer IV" },
      deckCapacity: 8,
      nextSlot: null,
    });
    expect(leagueProgress(500, 100).peakTrophies).toBe(500);
  });

  it("improves the distribution and loot at every promotion, preserving the rarity of each chest", () => {
    for (const league of LEAGUES) {
      expect(
        Object.values(league.chestChances).reduce((a, b) => a + b, 0),
      ).toBeCloseTo(100);
      const previous = LEAGUES[Math.max(0, league.index - 1)]!;
      expect(league.chestChances.common).toBeLessThanOrEqual(
        previous.chestChances.common,
      );
      expect(league.chestChances.legendary).toBeGreaterThanOrEqual(
        previous.chestChances.legendary,
      );
      expect(league.lootMultiplier).toBeGreaterThanOrEqual(
        previous.lootMultiplier,
      );
      let boundary = 0;
      for (const rarity of RARITIES) {
        expect(
          rollChest(() => (boundary + 0.001) / 100, league.minTrophies),
        ).toBe(rarity);
        boundary += league.chestChances[rarity];
        expect(chestLoot(rarity, () => 0, league.minTrophies)[0]).toMatchObject(
          {
            variantId: `guardian:${rarity}`,
            count: Math.floor(CHEST_RULES[rarity].min * league.lootMultiplier),
          },
        );
        expect(chestGold(rarity, () => 0.999999, league.minTrophies)).toBe(
          Math.floor(CHEST_RULES[rarity].maxGold * league.lootMultiplier),
        );
      }
    }
    expect(rollChest(() => 0.95, 0)).toBe("epic");
    expect(rollChest(() => 0.95, 2400)).toBe("legendary");
  });
});
