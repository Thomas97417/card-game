import { useEffect, useRef, useState, type RefObject } from "react";
import type { GameEvent } from "@sylve/game";
import type { BattleScene } from "./battle-animations";

export function useBattleAnimations(
  arena: RefObject<HTMLElement | null>,
  host: RefObject<HTMLDivElement | null>,
  events: readonly GameEvent[],
) {
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [scene, setScene] = useState<BattleScene | null>(null);
  const frameStarted = useRef(0);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotionAllowed(!media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    frameStarted.current = performance.now();
  }, [events]);
  useEffect(() => {
    const root = arena.current;
    const layer = host.current;
    // A hidden/unlaid-out arena needs no renderer (also keeps SSR DOM-only).
    if (!motionAllowed || !root || !layer || !root.clientWidth) return;
    const controller = new AbortController();
    let current: BattleScene | null = null;
    void import("./battle-animations")
      .then(({ createBattleScene }) => createBattleScene(root, layer, controller.signal))
      .then((loaded) => {
        if (controller.signal.aborted) { loaded?.destroy(); return; }
        current = loaded;
        setScene(loaded);
      })
      .catch(() => {
        // Keep the existing CSS animations when a chunk or renderer cannot load.
      });
    return () => {
      controller.abort();
      current?.destroy();
      setScene(null);
    };
  }, [arena, host, motionAllowed]);
  useEffect(() => {
    if (!scene || !events.length) return;
    // Summons commit at t=0; wait for their DOM anchors before measuring them.
    const frame = requestAnimationFrame(() => {
      scene.play(events, performance.now() - frameStarted.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [events, scene]);
  useEffect(() => {
    if (!scene) return;
    const update = () => { if (document.hidden) scene.clear(); };
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [scene]);
}
