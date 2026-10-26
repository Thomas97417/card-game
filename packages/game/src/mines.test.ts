import { describe, expect, it } from "vitest";
import { changeMineLevel, HOUR_MS, mineAmount, mineRules, mineView, type MineState } from "./mines";

const state: MineState = { amount: 0, updatedAt: 1000, heroLevel: 1, revision: 0 };

describe("production des mines", () => {
  it("scales hourly production and capped storage with the hero level", () => {
    expect(mineRules("gold", 1)).toEqual({ perHour: 6, capacity: 48 });
    expect(mineRules("emeralds", 1)).toEqual({ perHour: 2, capacity: 16 });
    expect(mineRules("gold", 5)).toEqual({ perHour: 30, capacity: 240 });
    expect(mineRules("emeralds", 5)).toEqual({ perHour: 10, capacity: 80 });
  });

  it("produces while offline, exposes only whole resources, and pauses at the cap", () => {
    expect(mineAmount("gold", state, state.updatedAt + HOUR_MS / 2)).toBe(3);
    expect(mineView("emeralds", state, state.updatedAt + HOUR_MS / 4)).toMatchObject({ available: 0, nextInMs: 900_000 });
    expect(mineView("gold", state, state.updatedAt + HOUR_MS * 80)).toMatchObject({ available: 48, full: true, progress: 1 });
    expect(mineView("emeralds", state, state.updatedAt + HOUR_MS * 80)).toMatchObject({ available: 16, full: true });
  });

  it("never credits negative elapsed time or applies a new level retroactively", () => {
    expect(mineAmount("gold", state, 0)).toBe(0);
    const upgraded = changeMineLevel("gold", state, 3, state.updatedAt + HOUR_MS * 10);
    expect(upgraded.amount).toBe(48);
    expect(mineAmount("gold", upgraded, upgraded.updatedAt + HOUR_MS)).toBe(66);
    expect(mineRules("gold", 3).capacity).toBe(144);
  });
});
