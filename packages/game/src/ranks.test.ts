import { describe, expect, it } from "vitest";
import source from "../../../docs/references/cunt-wars/rules.json";
import catalogue from "./data/cunt-wars.json";
import { MAX_RANK, nextFriendSlotUnlock, rankBenefits, rankEmeraldReward, rankProgress, rankSoulbindUnlocks } from "./ranks";

describe("CW account ranks", () => {
  it("keeps the lightweight soulbind projection aligned with the complete catalogue", () => {
    const ranks = catalogue.cards.flatMap((card) => card.soulbinds.map((link) => link.rank));
    for (const rank of new Set(ranks)) {
      expect(rankSoulbindUnlocks(rank - 1, rank)).toBe(ranks.filter((value) => value === rank).length);
    }
    expect(rankSoulbindUnlocks(0, MAX_RANK)).toBe(ranks.length);
  });
  it("matches every independently collected rank threshold, friend cap, mine level and gem award", () => {
    const rows = source.Rank.tables.flatMap((table) => table.rows).filter((row) => /^\d+$/.test(row[0]!));
    expect(rows).toHaveLength(MAX_RANK);
    let experience = 0;
    for (const row of rows) {
      const rank = Number(row[0]);
      expect(rankProgress(experience).rank).toBe(rank);
      expect(rankBenefits(rank)).toEqual({
        friends: row[2] === "Locked" ? 0 : Number(row[2]),
        mineLevel: Number(row[3]),
        emeralds: Number(row[4]),
      });
      if (rank > 1) expect(rankEmeraldReward(rank - 1, rank)).toBe(Number(row[4]));
      experience += Number(row[1]!.replaceAll(",", ""));
    }
  });

  it("handles exact boundaries, several ranks, invalid input and the final rank", () => {
    expect(rankProgress(14)).toMatchObject({ rank: 1, earned: 14, required: 15 });
    expect(rankProgress(15)).toMatchObject({ rank: 2, earned: 0, required: 45 });
    expect(rankProgress(149)).toMatchObject({ rank: 5, earned: 29, required: 30 });
    expect(rankProgress(150)).toMatchObject({ rank: 6, earned: 0 });
    expect(rankProgress(NaN).rank).toBe(1);
    expect(rankProgress(-1).rank).toBe(1);
    expect(rankProgress(1e12)).toMatchObject({ rank: MAX_RANK, required: 0 });
    expect(rankEmeraldReward(1, 5)).toBe(14);
    expect(rankEmeraldReward(5, 5)).toBe(0);
    expect(rankEmeraldReward(10, 5)).toBe(0);
  });

  it("unlocks friends at five, further slots at ten, and soulbind rank eligibility at six", () => {
    expect(rankBenefits(4).friends).toBe(0);
    expect(rankBenefits(5)).toMatchObject({ friends: 5, mineLevel: 1 });
    expect(rankBenefits(6).mineLevel).toBe(2);
    expect(nextFriendSlotUnlock(1)).toEqual({ rank: 5, friends: 5 });
    expect(nextFriendSlotUnlock(5)).toEqual({ rank: 10, friends: 7 });
    expect(nextFriendSlotUnlock(MAX_RANK)).toBeNull();
    expect(rankSoulbindUnlocks(1, 5)).toBe(0);
    expect(rankSoulbindUnlocks(5, 6)).toBeGreaterThan(0);
  });
});
