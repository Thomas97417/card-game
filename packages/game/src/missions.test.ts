import { describe, expect, it } from "vitest";
import {
  currentMissionState,
  epicMissionTarget,
  missionBoard,
  missionPeriod,
} from "./missions";

describe("calendrier et parcours des missions", () => {
  it("resets days at midnight UTC and weeks on Monday across years and DST", () => {
    const sunday = Date.parse("2026-10-25T23:59:59.999Z");
    expect(missionPeriod("daily", sunday).resetsAt).toBe(
      Date.parse("2026-10-26T00:00:00Z"),
    );
    expect(missionPeriod("weekly", sunday).resetsAt).toBe(
      Date.parse("2026-10-26T00:00:00Z"),
    );
    expect(
      missionPeriod("weekly", Date.parse("2027-01-01T13:00:00Z")).key,
    ).toBe(`weekly:${Date.parse("2026-12-28T00:00:00Z")}`);
    expect(missionPeriod("daily", sunday + 1).key).not.toBe(
      missionPeriod("daily", sunday).key,
    );
  });

  it("resets only expired tracks and keeps epic progress and tiers", () => {
    const now = Date.parse("2026-10-21T20:00:00Z");
    const state = currentMissionState(null, now);
    state.daily.counters.battles = 3;
    state.daily.seals = 20;
    state.daily.claimed = ["daily-battle"];
    state.weekly.counters.battles = 7;
    state.lifetime.wins = 5;
    state.epicTiers["epic-wins"] = 1;
    const next = missionBoard(state, now + 86_400_000);
    expect(next.daily.seals).toBe(0);
    expect(next.daily.missions[0]).toMatchObject({
      progress: 0,
      status: "active",
    });
    expect(next.weekly.missions[0]!.progress).toBe(7);
    expect(next.epic[0]).toMatchObject({
      progress: 5,
      target: 15,
      reward: 30,
      tier: 1,
    });
    expect(next.hasClaimable).toBe(false);
  });

  it("requires manual claims for seals, flags ready chests, and preserves cumulative epic progress", () => {
    const now = Date.now();
    const state = currentMissionState(null, now);
    state.daily.counters.battles = 2;
    let board = missionBoard(state, now);
    expect(board.daily.seals).toBe(0);
    expect(board.daily.chests[0]!.status).toBe("active");
    expect(board.hasClaimable).toBe(true);
    state.daily.claimed = ["daily-battle"];
    state.daily.seals = 20;
    board = missionBoard(state, now);
    expect(board.daily.missions[0]!.status).toBe("claimed");
    expect(board.daily.chests[0]!.status).toBe("ready");
    expect(board.hasClaimable).toBe(true);
    state.lifetime.wins = 30;
    state.epicTiers["epic-wins"] = 2;
    expect(missionBoard(state, now).epic[0]).toMatchObject({
      progress: 30,
      target: 30,
      reward: 45,
      status: "ready",
    });
    expect(epicMissionTarget(5, 3)).toBe(50);
  });
});
