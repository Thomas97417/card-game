import { Howl, Howler } from "howler";
import type { GameEvent } from "@sylve/game";
import sprite from "./combat-audio-sprite.json";
import { combatAudioCues, type CombatAudioCue, type CombatSound } from "./combat-audio-cues";
import { combatActorKey } from "./combat-visuals";

export interface BattleAudioPreferences { enabled: boolean; volume: number }
const maxVoices = 8;

/** Isolated Howler buses: changing combat audio never changes other app sounds. */
export function createBattleAudio(root: HTMLElement, initial: BattleAudioPreferences) {
  let preferences = initial;
  let destroyed = false;
  let unlocked = false;
  let suspended = document.hidden;
  let finished: boolean | null = null;
  let ambienceId: number | null = null;
  const scheduled = new Set<number>();
  const voices = new Set<number>();
  const seen = new Set<string>();
  const effects = new Howl({
    src: ["/audio/combat/effects.wav"],
    sprite: sprite as Record<CombatSound, [number, number]>,
    preload: true, pool: maxVoices,
    onend: (id) => { voices.delete(id); },
  });
  const ambience = new Howl({ src: ["/audio/combat/ambience.wav"], preload: true, loop: true, volume: 0 });
  const audible = () => !destroyed && !Howler.noAudio && unlocked && !suspended && !document.hidden && preferences.enabled && preferences.volume > 0;
  const ambientVolume = () => preferences.volume * 0.22;
  const updateAmbience = () => {
    if (!audible() || finished !== null) {
      ambience.pause();
      return;
    }
    if (ambience.state() !== "loaded") return;
    if (ambienceId !== null && ambience.playing(ambienceId)) return;
    ambienceId = ambienceId === null ? ambience.play() : ambience.play(ambienceId);
    ambience.volume(0, ambienceId);
    ambience.fade(0, ambientVolume(), 900, ambienceId);
  };
  const emit = (cue: CombatAudioCue) => {
    // Never queue a missed hit for replay when a file loads or audio unlocks later.
    if (!audible() || effects.state() !== "loaded" || (Howler.ctx && Howler.ctx.state !== "running")) return;
    while (voices.size >= maxVoices) {
      const oldest = voices.values().next().value!;
      effects.stop(oldest);
      voices.delete(oldest);
    }
    const id = effects.play(cue.sound);
    voices.add(id);
    effects.volume(preferences.volume * cue.gain, id);
    effects.stereo(cue.pan, id);
    effects.rate(cue.sound === "victory" || cue.sound === "defeat" ? 1 : 0.97 + Math.abs(cue.seed % 5) * 0.015, id);
  };
  const cancelFrame = () => {
    for (const timer of scheduled) window.clearTimeout(timer);
    scheduled.clear();
  };
  const stop = () => { cancelFrame(); effects.stop(); voices.clear(); ambience.pause(); };
  const unlockedAudio = () => {
    if (destroyed) return;
    unlocked = true;
    updateAmbience();
  };
  ambience.on("load", updateAmbience);
  effects.once("unlock", unlockedAudio);
  return {
    unlock() {
      if (destroyed) return;
      if (Howler.ctx && Howler.ctx.state !== "running") {
        void Howler.ctx.resume().then(unlockedAudio).catch(() => {});
      } else unlockedAudio();
    },
    setPreferences(next: BattleAudioPreferences) {
      preferences = next;
      if (!next.enabled || next.volume === 0) stop();
      else {
        // Stop a running fade before applying a new user-selected volume.
        ambience.volume(ambientVolume());
        for (const id of voices) effects.volume(next.volume * 0.7, id);
        updateAmbience();
      }
    },
    play(events: readonly GameEvent[], elapsed: number, viewer: number) {
      if (destroyed) return;
      if (!events.length) { cancelFrame(); return; }
      const key = events.map((event) => event.seq).join(":");
      if (seen.has(key)) return;
      cancelFrame();
      seen.add(key);
      if (seen.size > 128) seen.delete(seen.values().next().value!);
      if (!audible() || finished !== null) return;
      const actors = new Map([...root.querySelectorAll<HTMLElement>("[data-combat-actor]")]
        .map((actor) => [actor.dataset.combatActor, actor.dataset.combatType]));
      const cues = combatAudioCues(events, viewer, (actor) => actors.get(combatActorKey(actor)) === "ranged");
      const started = performance.now() - elapsed;
      for (const cue of cues) {
        if (elapsed > cue.at + 60) continue;
        const delay = Math.max(0, cue.at - elapsed);
        if (!delay) emit(cue);
        else {
          const timer = window.setTimeout(() => {
            scheduled.delete(timer);
            if (performance.now() - started <= cue.at + 80) emit(cue);
          }, delay);
          scheduled.add(timer);
        }
      }
    },
    cancelFrame,
    finish(won: boolean) {
      if (finished !== null || destroyed) return;
      finished = won;
      stop();
      emit({ sound: won ? "victory" : "defeat", at: 0, pan: 0, gain: 0.85, seed: 0 });
    },
    setHidden(hidden: boolean) {
      suspended = hidden;
      if (hidden) stop();
      else updateAmbience();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      effects.unload();
      ambience.unload();
    },
  };
}

export type BattleAudio = ReturnType<typeof createBattleAudio>;
