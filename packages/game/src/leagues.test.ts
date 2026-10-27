import { describe, expect, it } from "vitest";
import {
  DECK_SLOT_UNLOCKS,
  LEAGUES,
  deckCapacity,
  leagueAt,
  leagueProgress,
} from "./leagues";
import { CHEST_TYPES, chestPool, rollChest } from "./progression";

describe("league progression", () => {
  it("starts at Iron IV, promotes on exact thresholds and ends at Challenger", () => {
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
      current: { label: "Challenger", division: null },
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
      current: { label: "Fer IV" },
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

  it("normalizes CW drop weights and unlocks chests only at their documented leagues", () => {
    expect(chestPool(0)).toEqual({
      common: 1000,
      rare: 0,
      bigRare: 0,
      epic: 0,
      legendary: 0,
    });
    expect(chestPool(800)).toEqual({
      common: 962, rare: 0, bigRare: 38, epic: 0, legendary: 0,
    });
    expect(chestPool(1000)).toEqual({
      common: 750, rare: 195, bigRare: 38, epic: 0, legendary: 0,
    });
    expect(chestPool(2000)).toEqual({
      common: 750,
      rare: 212,
      bigRare: 38,
      epic: 12,
      legendary: 0,
    });
    expect(chestPool(4000)).toEqual({
      common: 752,
      rare: 200,
      bigRare: 38,
      epic: 12,
      legendary: 3,
    });
    for (const league of LEAGUES) {
      expect(league.chestChances.common).toBeGreaterThan(0);
      for (const [type, threshold] of [["rare", 1000], ["bigRare", 800], ["epic", 2000], ["legendary", 4000]] as const)
        expect(league.chestChances[type] > 0).toBe(league.minTrophies >= threshold);
      expect(
        Object.values(league.chestChances).reduce((a, b) => a + b, 0),
      ).toBeCloseTo(100);
      let boundary = 0;
      for (const type of CHEST_TYPES) {
        if (league.chestChances[type] === 0) continue;
        expect(
          rollChest(() => (boundary + 0.001) / 100, league.minTrophies),
        ).toBe(type);
        boundary += league.chestChances[type];
      }
    }
    expect(rollChest(() => 0.9999, 0)).toBe("common");
    expect(rollChest(() => 0.9999, 800)).toBe("bigRare");
    expect(rollChest(() => 0.9999, 2000)).toBe("epic");
    expect(rollChest(() => 0.9999, 4000)).toBe("legendary");
    expect(rollChest(() => 0.9999, 0, {common: 0, rare: 56, bigRare: 10, epic: 3, legendary: 1})).toBe("common");
  });
});
