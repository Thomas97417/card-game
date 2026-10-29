import { describe, expect, it } from "vitest";
import { cardRequestLimits, isRequestableRarity } from "./card-requests";

describe("card request rules", () => {
  it("supports only common and rare cards", () => {
    expect(isRequestableRarity("common")).toBe(true);
    expect(isRequestableRarity("rare")).toBe(true);
    expect(isRequestableRarity("epic")).toBe(false);
    expect(isRequestableRarity("legendary")).toBe(false);
    expect(isRequestableRarity(undefined)).toBe(false);
  });

  it("follows league thresholds and keeps the Cunt Wars XP rewards", () => {
    expect(cardRequestLimits(0)).toEqual({
      common: { request: 5, donate: 12, experience: 1 },
      rare: { request: 2, donate: 2, experience: 3 },
    });
    expect(cardRequestLimits(799).rare.donate).toBe(2);
    expect(cardRequestLimits(800).rare.donate).toBe(3);
    expect(cardRequestLimits(2000).common).toEqual({
      request: 32,
      donate: 17,
      experience: 1,
    });
    expect(cardRequestLimits(6000)).toEqual({
      common: { request: 150, donate: 30, experience: 1 },
      rare: { request: 31, donate: 7, experience: 3 },
    });
    expect(cardRequestLimits(999999)).toEqual(cardRequestLimits(6000));
  });
});
