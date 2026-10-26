import { describe, expect, it } from "vitest";
import { requireGameAuth, safeReturnTo } from "./game-auth";

describe("hub authentication destinations", () => {
  it("defaults to the hub and accepts its legacy address", () => {
    expect(safeReturnTo(undefined)).toBe("/hub");
    expect(safeReturnTo("/hub")).toBe("/hub");
    expect(safeReturnTo("/dashboard")).toBe("/dashboard");
  });

  it("preserves game destinations and rejects external redirects", () => {
    expect(safeReturnTo("/arena?invite=ABCD1234")).toBe(
      "/arena?invite=ABCD1234",
    );
    expect(safeReturnTo("/play?code=invitation")).toBe("/play?code=invitation");
    expect(safeReturnTo("/game/duel-123")).toBe("/game/duel-123");
    expect(safeReturnTo("https://example.com/hub")).toBe("/hub");
    expect(safeReturnTo("//example.com/hub")).toBe("/hub");
  });

  it("preserves protected destinations after reconnecting", () => {
    expect(safeReturnTo("/sanctuary?checkout=test#gold-packs")).toBe(
      "/sanctuary?checkout=test#gold-packs",
    );
    expect(safeReturnTo("/guardian")).toBe("/guardian");
    expect(safeReturnTo("/settings")).toBe("/settings");
    expect(safeReturnTo("/sanctuary/other")).toBe("/hub");
  });

  it("marks protected routes for the client session gate", () => {
    expect(requireGameAuth(true, "/sanctuary")).toEqual({
      requiresGameAuth: true,
    });
    expect(() => requireGameAuth(false, "/sanctuary")).toThrow();
  });
});
