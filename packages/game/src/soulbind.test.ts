import { describe, expect, it } from "vitest";
import {
  CARD_VARIANTS,
  resolveCard,
  soulbindDefinitions,
  soulbindStatus,
  requireSoulbind,
  rankProgress,
  dustConversion,
  evolutionOptions,
  catalogueMigration,
  type OwnedCard,
} from "./index";

const progress = { rank: 1000, soulDust: 10000, unlocked: true };
const complete = (): OwnedCard[] =>
  CARD_VARIANTS.map((c) => ({ card: resolveCard(c.id, 26), copies: 100 }));
describe("Soulbind rules", () => {
  it("keeps all 336 links attainable using distinct, real cards in the retained 22 families", () => {
    const collection = complete();
    for (const card of CARD_VARIANTS) {
      const links = soulbindDefinitions(card.id);
      expect(links).toHaveLength(4);
      for (const link of links) {
        expect(new Set(link.requirements.map((r) => r.variantId)).size).toBe(
          link.requirements.length,
        );
        expect(
          requireSoulbind(card.id, link.tier, collection, progress).ready,
        ).toBe(true);
        for (const requirement of link.requirements)
          expect(
            collection.some((c) => c.card.id === requirement.variantId),
          ).toBe(true);
      }
    }
    expect(soulbindDefinitions("guardian:common")[0]).toMatchObject({
      cost: 0,
      rank: 6,
      health: 1,
      requirements: [{ variantId: "lynx:common", level: 6 }],
    });
    expect(soulbindDefinitions("fox:legendary").map((s) => s.cost)).toEqual([
      200, 250, 300, 350,
    ]);
  });
  it("allows IV before I, adds permanent bonuses once, and carries them through upgrades", () => {
    const collection = complete();
    expect(
      requireSoulbind("guardian:common", 4, collection, progress).ready,
    ).toBe(true);
    const base = resolveCard("guardian:common", 1);
    const linked = resolveCard("guardian:common", 1, [4, 1, 4]);
    expect(linked.health).toBe(base.health + 4);
    expect(linked.soulbinds).toEqual([1, 4]);
    expect(resolveCard("guardian:common", 2, [1, 4]).health).toBe(
      resolveCard("guardian:common", 2).health + 4,
    );
    collection[0]!.card = linked;
    expect(() => requireSoulbind(linked.id, 4, collection, progress)).toThrow(
      "déjà actif",
    );
  });
  it("enforces ownership, league, rank, prerequisite levels and dust independently", () => {
    const collection = complete();
    expect(() => requireSoulbind("guardian:common", 1, [], progress)).toThrow(
      "débloquée",
    );
    expect(() =>
      requireSoulbind("guardian:common", 1, collection, {
        ...progress,
        unlocked: false,
      }),
    ).toThrow("Bronze IV");
    expect(() =>
      requireSoulbind("guardian:common", 1, collection, {
        ...progress,
        rank: 1,
      }),
    ).toThrow("rang 6");
    const lynx = collection.find((c) => c.card.id === "lynx:common")!;
    lynx.card = resolveCard("lynx:common", 5);
    expect(() =>
      requireSoulbind("guardian:common", 1, collection, progress),
    ).toThrow("compagnons");
    expect(
      soulbindStatus("guardian:common", 1, collection, progress)
        .requirements[0],
    ).toMatchObject({ ownedLevel: 5, ready: false });
    expect(() =>
      requireSoulbind("guardian:common", 2, complete(), {
        ...progress,
        soulDust: 49,
      }),
    ).toThrow("poussière");
    for (const tier of [0, 5, 1.5, NaN])
      expect(() =>
        requireSoulbind("guardian:common", tier, collection, progress),
      ).toThrow();
  });
  it("uses the documented dust conversion ratios and rejects malformed quantities", () => {
    for (const [rarity, copies] of [
      ["common", 50],
      ["rare", 20],
      ["epic", 5],
      ["legendary", 1],
    ] as const)
      expect(dustConversion(rarity, 2)).toEqual({
        copies: copies * 2,
        soulDust: 20,
      });
    for (const batches of [0, -1, 0.1, Infinity, NaN, 10001])
      expect(() => dustConversion("common", batches)).toThrow();
  });
  it("derives rank from earned upgrade XP, including exact rank boundaries", () => {
    expect(rankProgress(0)).toMatchObject({ rank: 1, earned: 0, required: 15 });
    expect(rankProgress(14)).toMatchObject({ rank: 1, earned: 14 });
    expect(rankProgress(15)).toMatchObject({
      rank: 2,
      earned: 0,
      required: 45,
    });
    expect(rankProgress(60)).toMatchObject({ rank: 3, earned: 0 });
    expect(rankProgress(NaN).rank).toBe(1);
  });
  it("retains actual evolution rates, alternative in-catalogue branches and terminal forms", () => {
    expect(evolutionOptions("guardian:common")).toEqual([
      { variantId: "guardian:rare", cost: 50, count: 5 },
    ]);
    expect(evolutionOptions("guardian:epic")).toEqual([
      { variantId: "guardian:legendary", cost: 20, count: 1 },
    ]);
    expect(evolutionOptions("turtle:common").map((o) => o.variantId)).toEqual([
      "turtle:rare",
      "mushroom:rare",
      "dragon:rare",
    ]);
    expect(evolutionOptions("wolf:legendary")).toEqual([]);
  });
});

describe("CW migration", () => {
  it("merges a removed common into its rare form without losing reserves or invested upgrades", () => {
    const migrated = catalogueMigration([
      { variantId: "wolf:common", level: 2, copies: 10 },
      { variantId: "wolf:rare", level: 5, copies: 20 },
    ]);
    expect(migrated.cards).toHaveLength(1);
    expect(migrated.cards[0]).toMatchObject({
      variantId: "wolf:rare",
      level: 5,
      copies: 56,
    });
    expect(migrated.goldRefund).toBe(50);
    const second = catalogueMigration(migrated.cards);
    expect(second.cards[0]).toMatchObject({
      variantId: "wolf:rare",
      level: 5,
      copies: 56,
    });
    expect(second.goldRefund).toBe(0);
  });
  it("caps old level-31 forms and refunds their five removed upgrades exactly once", () => {
    const migrated = catalogueMigration([
      { variantId: "fox:rare", level: 31, copies: 9 },
    ]);
    expect(migrated.cards[0]!.level).toBe(26);
    expect(migrated.cards[0]!.copies).toBeGreaterThan(9);
    expect(migrated.goldRefund).toBeGreaterThan(0);
    const repeated = catalogueMigration(migrated.cards);
    expect(repeated.goldRefund).toBe(0);
    expect(repeated.cards[0]!.copies).toBe(migrated.cards[0]!.copies);
  });
});
