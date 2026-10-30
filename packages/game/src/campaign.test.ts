import { describe, expect, it } from "vitest";
import { getCombatType, resolveCard } from "./index";
import { CAMPAIGN_REGIONS, CAMPAIGN_TOTAL_STAGES, campaignOpponent, campaignStage, campaignStageReward } from "./campaign";

describe("aventure", () => {
  it("maps forty ordered stages to four distinct battlefields and rejects invalid coordinates", () => {
    expect(CAMPAIGN_TOTAL_STAGES).toBe(40);
    expect(new Set(CAMPAIGN_REGIONS.map((region) => region.arena)).size).toBe(4);
    expect(campaignStage(1, 10)).toMatchObject({ index: 9, label: "1-10", boss: true });
    expect(campaignStage(2, 1)).toMatchObject({ index: 10, label: "2-1", boss: false });
    expect(campaignStage(4, 10)).toMatchObject({ index: 39 });
    for (const [region, stage] of [[0, 1], [5, 1], [1, 0], [1, 11], [1.5, 1], [1, NaN], [Infinity, 1]]) {
      expect(campaignStage(region!, stage!)).toBeNull();
    }
  });

  it("guarantees an epic chest at every tenth stage and increasing first-clear gold", () => {
    let previousGold = 0;
    for (let region = 1; region <= 4; region++) {
      for (let stage = 1; stage <= 10; stage++) {
        const reward = campaignStageReward(region, stage);
        expect(reward.gold).toBeGreaterThan(0);
        expect(reward.chest).toBe(stage === 10 ? "epic" : null);
        expect(reward.emeralds).toBe(stage === 10 ? region * 150 : stage === 5 ? region * 50 : 0);
        if (stage === 1) { expect(reward.gold).toBeGreaterThan(previousGold); previousGold = reward.gold; }
      }
    }
  });

  it("builds valid, varied opponents at every stage and supported deck size", () => {
    for (const size of [4, 6, 8, 10]) {
      for (let region = 1; region <= 4; region++) {
        for (let stage = 1; stage <= 10; stage++) {
          const opponent = campaignOpponent(region, stage, size, () => 0.42);
          expect(opponent.cards).toHaveLength(size);
          expect(new Set(opponent.cards.map((card) => card.baseId)).size).toBe(size);
          expect(opponent.cards.some((card) => getCombatType(card) === "melee")).toBe(true);
          expect(opponent.cards.some((card) => getCombatType(card) === "ranged")).toBe(true);
          for (const card of opponent.cards) {
            expect(card).toEqual(resolveCard(card.id, opponent.level));
            expect(card.attack).toBeGreaterThanOrEqual(0);
            expect(card.health).toBeGreaterThan(0);
          }
          if (stage === 10) expect(opponent.name).toBe(CAMPAIGN_REGIONS[region - 1]!.boss);
        }
      }
    }
    expect(campaignOpponent(4, 10, 4, () => 0.42).level).toBeGreaterThan(campaignOpponent(1, 1, 4, () => 0.42).level);
  });
});
