import { describe, expect, it, vi } from "vitest";
import { CARD_VARIANT_IDS, isCardVariantId } from "./card-ids";

describe("initialisation du catalogue", () => {
  it("loads the CW source before the cards, as a Convex bundle may do", async () => {
    vi.resetModules();
    const source = await import("./cw-catalogue");
    expect(source.availableRarities("guardian")).toEqual([
      "common", "rare", "epic", "legendary",
    ]);
    const { CARD_VARIANTS, GameError, resolveCard } = await import("./cards");
    expect(CARD_VARIANTS).toHaveLength(84);
    expect([...CARD_VARIANT_IDS].sort()).toEqual(CARD_VARIANTS.map((card) => card.id).sort());
    expect(resolveCard("guardian:common")).toMatchObject({
      attack: 3,
      health: 10,
    });
    expect(() => source.availableRarities("missing")).toThrow(GameError);
    expect(() => resolveCard("missing:common")).toThrow(GameError);
  });

  it("validates card links with exactly the supported variants", () => {
    for (const id of CARD_VARIANT_IDS) expect(isCardVariantId(id)).toBe(true);
    for (const invalid of [undefined, null, 42, "guardian", "missing:common", "guardian:mythic", "guardian:common:extra"])
      expect(isCardVariantId(invalid)).toBe(false);
  });
});
