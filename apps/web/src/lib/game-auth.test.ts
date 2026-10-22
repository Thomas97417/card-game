import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./game-auth";

describe("hub authentication destinations", () => {
  it("defaults to the hub and accepts its legacy address", () => {
    expect(safeReturnTo(undefined)).toBe("/hub");
    expect(safeReturnTo("/hub")).toBe("/hub");
    expect(safeReturnTo("/dashboard")).toBe("/dashboard");
  });

  it("preserves game destinations and rejects external redirects", () => {
    expect(safeReturnTo("/play?code=invitation")).toBe("/play?code=invitation");
    expect(safeReturnTo("/game/duel-123")).toBe("/game/duel-123");
    expect(safeReturnTo("https://example.com/hub")).toBe("/hub");
    expect(safeReturnTo("//example.com/hub")).toBe("/hub");
  });
});
