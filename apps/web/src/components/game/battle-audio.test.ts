import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HowlOptions } from "howler";
import type { GameEvent } from "@sylve/game";
import { createBattleAudio } from "./battle-audio";
import { combatAudioCues } from "./combat-audio-cues";
import { COMBAT_TIMING } from "./combat-timing";
import sprite from "./combat-audio-sprite.json";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { combatActorKey } from "./combat-visuals";
import edits from "../../../../../scripts/combat-audio-edits.json";
import credits from "./combat-audio-credits.json";

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
  seq: 1, type: "attack", player: 0, cardId: "knight", row: 0, depth: 0,
  targetPlayer: 1, targetCardId: "bear", targetRow: 0, targetDepth: 0, damage: 3,
};
let audio: ReturnType<typeof createBattleAudio>;
let root: HTMLElement;
const effects = () => mocks.sounds[0]!;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  mocks.sounds.length = 0;
  root = document.createElement("main");
  audio = createBattleAudio(root, { enabled: true, volume: 0.6 });
});
afterEach(() => { audio.destroy(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("Howler combat clock and lifecycle", () => {
  it("uses the revised magic, water, thunder and orchestral palette with the required credits", () => {
    const sources = edits.flatMap((clip) => [clip.source, ...("layers" in clip ? clip.layers!.map((layer) => layer.source) : [])]);
    for (const retired of [160420, 449069, 609028, 556387, 801349, 483713, 737234, 737235, 512471, 529024, 394900, 844109, 410751]) {
      expect(sources).not.toContain(retired);
    }
    expect(edits.find((clip) => clip.name === "freeze")?.source).toBe(709888);
    expect(edits.find((clip) => clip.name === "claw-swing")?.source).toBe(591525);
    expect(edits.find((clip) => clip.name === "hit-storm")?.source).toBe(683420);
    expect(edits.find((clip) => clip.name === "hit-arrow")).toMatchObject({ source: 434147, levelDb: -6, lowpass: 1800 });
    expect(credits.map((credit) => credit.freesoundId).sort()).toEqual([470083, 793513]);
    for (const credit of credits) expect(credit.modifications).toBeTruthy();
  });

  it("loads the versioned Freesound recording with playable clips and no background loop", () => {
    expect(effects().options.src).toEqual([sprite.src]);
    expect(effects().options.sprite).toEqual(sprite.sprite);
    expect(effects().options.loop).toBe(false);
    const wav = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../../public", `.${sprite.src}`));
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.readUInt32LE(24)).toBe(44100);
    const hash = createHash("sha256").update(wav).digest("hex").slice(0, 12);
    expect(sprite.src).toBe(`/audio/combat/freesound-effects-${hash}.wav`);
    for (const variants of Object.values(sprite.sounds)) {
      for (const name of variants) {
        const [start, duration] = sprite.sprite[name as keyof typeof sprite.sprite];
        const first = Math.round(start / 1000 * 44100);
        const last = first + Math.round(duration / 1000 * 44100);
        expect(44 + last * 2).toBeLessThanOrEqual(wav.length);
        let peak = 0;
        for (let index = first; index < last; index++) peak = Math.max(peak, Math.abs(wav.readInt16LE(44 + index * 2)));
        expect(peak).toBeGreaterThan(1000);
        expect(peak).toBeLessThanOrEqual(Math.ceil(32767 * 0.58));
      }
    }
  });

  it("requires interaction, keeps an unchanged frame scheduled and lands damage at the shared impact", () => {
    audio.play([attack], 0, 0);
    expect(effects().play).not.toHaveBeenCalled();
    audio.unlock();
    expect(mocks.sounds).toHaveLength(1);
    expect(effects().play).not.toHaveBeenCalled();
    const next = { ...attack, seq: 2 };
    audio.play([next], 0, 0);
    expect(effects().play).toHaveBeenCalledExactlyOnceWith("swing-3");
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

  it("varies melee recordings and preserves each effect's mix when changing volume", () => {
    audio.unlock();
    for (const seq of [1, 2, 3]) audio.play([{ ...attack, seq }], 0, 0);
    expect(effects().play.mock.calls.map(([name]) => name)).toEqual(["swing-2", "swing-3", "swing"]);
    vi.advanceTimersByTime(COMBAT_TIMING.impact);
    const volumes = effects().volume.mock.calls.slice();
    effects().volume.mockClear();
    audio.setPreferences({ enabled: true, volume: 0.3 });
    expect(effects().volume.mock.calls).toEqual(volumes.map(([volume, id]) => [volume / 2, id]));
  });

  it("reads the exact unit's voice from the board, including independent copies and elemental spirits", () => {
    for (const [row, profile] of ["ranged:mage:fire", "ranged:spirit:water"].entries()) {
      const actor = document.createElement("button");
      actor.dataset.combatActor = combatActorKey({ player: 0, cardId: "token-custom", row, depth: 0 });
      actor.dataset.combatAudio = profile;
      root.append(actor);
    }
    audio.unlock();
    audio.play([{ ...attack, seq: 10, cardId: "token-custom", row: 0 }], 0, 0);
    audio.play([{ ...attack, seq: 11, cardId: "token-custom", row: 1 }], 0, 0);
    expect(effects().play.mock.calls.map(([name]) => name)).toEqual(["cast-fire", "cast-water"]);
    expect(effects().rate).toHaveBeenLastCalledWith(1.12 * 0.985, expect.any(Number));
    vi.advanceTimersByTime(COMBAT_TIMING.impact);
    expect(effects().play).toHaveBeenLastCalledWith("hit-water");
  });
});

describe("sound selection", () => {
  it("groups area effects, preserves defensive sounds and mirrors stereo for the viewer", () => {
    const area: GameEvent[] = [0, 1, 2].map((row) => ({
      seq: row + 1, type: "ability", player: 0, cardId: "hero", targetPlayer: 1,
      targetCardId: "fox", targetRow: row, targetDepth: 0, ability: "Dégâts magiques", amount: -3,
    }));
    const cues = combatAudioCues(area, 0);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ sound: "hit-nature", at: COMBAT_TIMING.abilityImpact, pan: 0.55 });
    expect(combatAudioCues(area, 1)[0]?.pan).toBe(-0.55);
    expect(combatAudioCues([{ ...attack, damage: 0, cardId: "fox" }], 0).map((cue) => cue.sound)).toEqual(["shot", "shield"]);
    expect(combatAudioCues([{ ...area[0]!, ability: "Fin du gel" }], 0)).toEqual([]);
  });
});
