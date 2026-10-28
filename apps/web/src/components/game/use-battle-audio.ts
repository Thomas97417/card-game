import { useEffect, useRef, useState, type RefObject } from "react";
import type { GameEvent } from "@sylve/game";
import type { BattleAudio, BattleAudioPreferences } from "./battle-audio";

export const BATTLE_AUDIO_STORAGE_KEY = "sylve:combat-audio";
const defaults: BattleAudioPreferences = { enabled: true, volume: 0.55 };

export function useBattleAudio(
  root: RefObject<HTMLElement | null>,
  events: readonly GameEvent[],
  viewer: number,
  outcome: boolean | null,
) {
  const [preferences, setPreferences] = useState(defaults);
  const [audio, setAudio] = useState<BattleAudio | null>(null);
  const latestPreferences = useRef(preferences);
  const frameStarted = useRef(0);
  useEffect(() => {
    frameStarted.current = performance.now();
  }, [events]);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(BATTLE_AUDIO_STORAGE_KEY) ?? "null");
      if (saved && typeof saved === "object" && "enabled" in saved && "volume" in saved &&
        typeof saved.enabled === "boolean" && typeof saved.volume === "number" && Number.isFinite(saved.volume)) {
        const next = { enabled: saved.enabled, volume: Math.max(0, Math.min(1, saved.volume)) };
        latestPreferences.current = next;
        setPreferences(next);
      }
    } catch { /* Storage can be unavailable in private browsing. */ }
  }, []);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let disposed = false;
    let current: BattleAudio | null = null;
    let interacted = false;
    const activate = () => { interacted = true; current?.unlock(); };
    const visibility = () => current?.setHidden(document.hidden);
    window.addEventListener("pointerdown", activate, { passive: true });
    window.addEventListener("keydown", activate);
    document.addEventListener("visibilitychange", visibility);
    void import("./battle-audio").then(({ createBattleAudio }) => {
      if (disposed) return;
      current = createBattleAudio(element, latestPreferences.current);
      if (interacted) current.unlock();
      setAudio(current);
    }).catch(() => { /* Combat remains available if audio cannot initialize. */ });
    return () => {
      disposed = true;
      window.removeEventListener("pointerdown", activate);
      window.removeEventListener("keydown", activate);
      document.removeEventListener("visibilitychange", visibility);
      current?.destroy();
    };
  }, [root]);
  useEffect(() => { audio?.setPreferences(preferences); }, [audio, preferences]);
  useEffect(() => {
    audio?.play(events, performance.now() - frameStarted.current, viewer);
  }, [audio, events, viewer]);
  useEffect(() => { if (outcome !== null) audio?.finish(outcome); }, [audio, outcome]);

  function update(next: BattleAudioPreferences) {
    latestPreferences.current = next;
    setPreferences(next);
    try { localStorage.setItem(BATTLE_AUDIO_STORAGE_KEY, JSON.stringify(next)); } catch { /* Optional persistence. */ }
  }
  return {
    ...preferences,
    toggle: () => update({ ...preferences, enabled: !preferences.enabled }),
    setVolume: (volume: number) => update({ ...preferences, volume: Math.max(0, Math.min(1, volume)) }),
  };
}
