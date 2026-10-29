import { Howl, Howler } from "howler";
import sprite from "@/components/game/combat-audio-sprite.json";

export function createFoundryAudio() {
  let enabled = true; let hidden = false; let destroyed = false;
  const sound = new Howl({ src: [sprite.src], sprite: Object.fromEntries(Object.entries(sprite.sprite).map(([name, range]) => [name, [range[0]!, range[1]!] as [number, number]])), pool: 6, volume: 0.5 });
  return {
    unlock() { if (Howler.ctx?.state === "suspended") void Howler.ctx.resume().catch(() => {}); },
    play(critical: boolean, broken: boolean) {
      if (!enabled || hidden || destroyed || document.hidden || sound.state() !== "loaded") return;
      const id = sound.play(sprite.sounds[broken ? "hit-blunt" : "hammer-hit"][0]!);
      sound.rate(critical ? 0.8 : 0.96 + Math.random() * 0.08, id); sound.volume(critical ? 0.65 : 0.4, id);
    },
    setEnabled(value: boolean) { enabled = value; if (!value) sound.stop(); },
    setHidden(value: boolean) { hidden = value; if (value) sound.stop(); },
    destroy() { destroyed = true; sound.unload(); },
  };
}
