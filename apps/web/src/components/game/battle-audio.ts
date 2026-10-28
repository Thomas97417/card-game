import { Howl, Howler } from "howler";
import type { GameEvent } from "@sylve/game";
import sprite from "./combat-audio-sprite.json";
import { combatAudioCues, type CombatAudioCue } from "./combat-audio-cues";
import { combatActorKey } from "./combat-visuals";
import { parseAudioProfile } from "./combat-audio-profile";

export interface BattleAudioPreferences { enabled: boolean; volume: number }
const maxVoices = 8;

/** Combat effects use their own Howler instance, without changing other app sounds. */
export function createBattleAudio(root: HTMLElement, initial: BattleAudioPreferences) {
  let preferences = initial;
  let destroyed = false;
  let unlocked = false;
  let suspended = document.hidden;
  let finished: boolean | null = null;
  const scheduled = new Set<number>();
  const voices = new Map<number, number>();
  const seen = new Set<string>();
  const effects = new Howl({
    src: [sprite.src],
    sprite: Object.fromEntries(Object.entries(sprite.sprite).map(([name, range]) =>
      [name, [range[0]!, range[1]!] as [number, number]])),
    loop: false,
    preload: true, pool: maxVoices,
    onend: (id) => { voices.delete(id); },
  });
  const audible = () => !destroyed && !Howler.noAudio && unlocked && !suspended && !document.hidden && preferences.enabled && preferences.volume > 0;
  const emit = (cue: CombatAudioCue) => {
    // Never queue a missed hit for replay when a file loads or audio unlocks later.
    if (!audible() || effects.state() !== "loaded" || (Howler.ctx && Howler.ctx.state !== "running")) return;
    while (voices.size >= maxVoices) {
      const oldest = voices.keys().next().value!;
      effects.stop(oldest);
      voices.delete(oldest);
    }
    const variants = sprite.sounds[cue.sound];
    const id = effects.play(variants[Math.abs(cue.seed) % variants.length]!);
    voices.set(id, cue.gain);
    effects.volume(preferences.volume * cue.gain, id);
    effects.stereo(cue.pan, id);
    effects.rate(cue.sound === "victory" || cue.sound === "defeat" ? 1 : (cue.pitch ?? 1) * (0.97 + Math.abs(cue.seed % 5) * 0.015), id);
  };
  const cancelFrame = () => {
    for (const timer of scheduled) window.clearTimeout(timer);
    scheduled.clear();
  };
  const stop = () => { cancelFrame(); effects.stop(); voices.clear(); };
  const unlockedAudio = () => {
    if (destroyed) return;
    unlocked = true;
  };
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
      else for (const [id, gain] of voices) effects.volume(next.volume * gain, id);
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
        .map((actor) => [actor.dataset.combatActor, parseAudioProfile(actor.dataset.combatAudio)]));
      const cues = combatAudioCues(events, viewer, (actor) => actors.get(combatActorKey(actor)));
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
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      effects.unload();
    },
  };
}

export type BattleAudio = ReturnType<typeof createBattleAudio>;
