import { describe, expect, it, vi } from "vitest";

describe("initialisation du catalogue", () => {
  it("loads the CW source before the cards, as a Convex bundle may do", async () => {
    vi.resetModules();
    const source = await import("./cw-catalogue");
    expect(source.availableRarities("guardian")).toEqual([
      "common", "rare", "epic", "legendary",
    ]);
    const { CARD_VARIANTS, GameError, resolveCard } = await import("./cards");
    expect(CARD_VARIANTS).toHaveLength(84);
    expect(resolveCard("guardian:common")).toMatchObject({
      attack: 3,
      health: 10,
    });
    expect(() => source.availableRarities("missing")).toThrow(GameError);
    expect(() => resolveCard("missing:common")).toThrow(GameError);
  });
});
