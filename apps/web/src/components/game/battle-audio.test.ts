import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HowlOptions } from "howler";
import type { GameEvent } from "@sylve/game";
import { createBattleAudio } from "./battle-audio";
import { combatAudioCues } from "./combat-audio-cues";
import { COMBAT_TIMING } from "./combat-timing";

const mocks = vi.hoisted(() => {
  const make = (options: HowlOptions) => ({
    options, play: vi.fn((_sprite?: string | number): number => Math.random()),
    state: vi.fn(() => "loaded"),
    volume: vi.fn(), stereo: vi.fn(), rate: vi.fn(),
    stop: vi.fn(), unload: vi.fn(), once: vi.fn(),
  });
  return { make, sounds: [] as ReturnType<typeof make>[] };
});
vi.mock("howler", () => ({
  Howler: { noAudio: false, ctx: { state: "running" } },
  Howl: vi.fn(function (options: HowlOptions) {
    const sound = mocks.make(options);
    mocks.sounds.push(sound);
    return sound;
  }),
}));

const attack: GameEvent = {
  seq: 1, type: "attack", player: 0, cardId: "fox", row: 0, depth: 0,
  targetPlayer: 1, targetCardId: "bear", targetRow: 0, targetDepth: 0, damage: 3,
};
let audio: ReturnType<typeof createBattleAudio>;
const effects = () => mocks.sounds[0]!;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  mocks.sounds.length = 0;
  audio = createBattleAudio(document.createElement("main"), { enabled: true, volume: 0.6 });
});
afterEach(() => { audio.destroy(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("Howler combat clock and lifecycle", () => {
  it("requires interaction, keeps an unchanged frame scheduled and lands damage at the shared impact", () => {
    audio.play([attack], 0, 0);
    expect(effects().play).not.toHaveBeenCalled();
    audio.unlock();
    expect(mocks.sounds).toHaveLength(1);
    expect(effects().play).not.toHaveBeenCalled();
    const next = { ...attack, seq: 2 };
    audio.play([next], 0, 0);
    expect(effects().play).toHaveBeenCalledExactlyOnceWith("swing");
    audio.play([{ ...next }], 0, 0);
    vi.advanceTimersByTime(COMBAT_TIMING.impact - 1);
    expect(effects().play).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(effects().play).toHaveBeenNthCalledWith(2, "strike");
    expect(effects().stereo.mock.calls.map(([pan]) => pan)).toEqual([-0.55, 0.55]);
    audio.play([next], 0, 0);
    expect(effects().play).toHaveBeenCalledTimes(2);
  });

  it("skips elapsed attacks and files that were not ready instead of queueing old sounds", () => {
    audio.unlock();
    audio.play([attack], 600, 0);
    expect(effects().play).not.toHaveBeenCalled();
    effects().state.mockReturnValue("loading");
    audio.play([{ ...attack, seq: 2 }], 0, 0);
    vi.advanceTimersByTime(260);
    effects().state.mockReturnValue("loaded");
    vi.advanceTimersByTime(1000);
    expect(effects().play).not.toHaveBeenCalled();
  });

  it("cancels pending impacts on mute or tab hiding and unloads on exit", () => {
    audio.unlock();
    audio.play([attack], 0, 0);
    audio.setPreferences({ enabled: false, volume: 0.6 });
    vi.advanceTimersByTime(300);
    expect(effects().play).toHaveBeenCalledTimes(1);
    audio.setPreferences({ enabled: true, volume: 0.6 });
    audio.play([{ ...attack, seq: 2 }], 0, 0);
    audio.setHidden(true);
    vi.advanceTimersByTime(300);
    expect(effects().play).toHaveBeenCalledTimes(2);
    audio.setHidden(false);
    expect(effects().play).toHaveBeenCalledTimes(2);
    audio.play([{ ...attack, seq: 3 }], 0, 0);
    audio.destroy(); audio.destroy();
    vi.advanceTimersByTime(500);
    expect(effects().play).toHaveBeenCalledTimes(3);
    expect(effects().unload).toHaveBeenCalledOnce();
  });

  it("limits simultaneous voices and plays the result only once", () => {
    audio.unlock();
    for (let index = 0; index < 12; index++) audio.play([{ seq: index, type: "summon", player: 0 }], 0, 0);
    expect(effects().stop).toHaveBeenCalledTimes(4);
    audio.finish(true); audio.finish(true);
    expect(effects().play.mock.calls.filter(([name]) => name === "victory")).toHaveLength(1);
    audio.play([{ ...attack, seq: 30 }], 0, 0);
    expect(effects().play).toHaveBeenCalledTimes(13);
  });
});

describe("sound selection", () => {
  it("groups area effects, preserves defensive sounds and mirrors stereo for the viewer", () => {
    const area: GameEvent[] = [0, 1, 2].map((row) => ({
      seq: row + 1, type: "ability", player: 0, cardId: "hero", targetPlayer: 1,
      targetCardId: "fox", targetRow: row, targetDepth: 0, ability: "Dégâts magiques", amount: -3,
    }));
    const cues = combatAudioCues(area, 0, () => false);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ sound: "magic", at: COMBAT_TIMING.abilityImpact, pan: 0.55 });
    expect(combatAudioCues(area, 1, () => false)[0]?.pan).toBe(-0.55);
    expect(combatAudioCues([{ ...attack, damage: 0 }], 0, () => true).map((cue) => cue.sound)).toEqual(["shot", "shield"]);
    expect(combatAudioCues([{ ...area[0]!, ability: "Fin du gel" }], 0, () => false)).toEqual([]);
  });
});
