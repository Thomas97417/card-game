import {
  AnimationState, AnimationStateData, Physics, Skeleton, type Bone,
} from "@esotericsoftware/spine-core";
import { gsap } from "gsap";
import type { CombatActor } from "./combat-visuals";
import { combatActorKey } from "./combat-visuals";
import { spineRigData, type RigProfile } from "./spine-rig-data";
export type { BattlePose } from "./spine-rig-data";
import type { BattlePose } from "./spine-rig-data";

export function createSpineActor(body: HTMLElement, facing = 1, phase = 0, profile: RigProfile = "humanoid") {
  const image = body instanceof HTMLImageElement ? body : body.querySelector("img");
  const aspect = image ? (image.naturalHeight || image.height || 1) / (image.naturalWidth || image.width || 1) : 1;
  const rig = spineRigData(profile, aspect);
  const skeleton = new Skeleton(rig.data);
  const mixData = new AnimationStateData(rig.data);
  mixData.defaultMix = 0.065;
  const state = new AnimationState(mixData);
  const bone: Bone = skeleton.bones[1]!;
  let rendered = false;
  const idle = () => {
    state.clearTracks();
    skeleton.setToSetupPose();
    state.setAnimation(0, "idle", true).trackTime = phase;
  };
  const draw = () => {
    state.apply(skeleton);
    skeleton.updateWorldTransform(Physics.none);
    // Spine uses Y-up; conjugate its bone matrix for CSS's Y-down space.
    if (!rendered) body.style.transform = `translate(${facing * bone.worldX}%, ${-bone.worldY}%) matrix(${bone.a}, ${-facing * bone.c}, ${-facing * bone.b}, ${bone.d}, 0, 0)`;
  };
  idle();
  draw();
  return {
    body,
    skeleton,
    attachment: rig.mesh,
    rigHeight: rig.height,
    setRendered(value: boolean) {
      rendered = value;
      if (value) { body.dataset.spineMesh = "ready"; body.style.removeProperty("transform"); }
      else { delete body.dataset.spineMesh; draw(); }
    },
    pose(name: Exclude<BattlePose, "idle">, elapsed = 0, duration?: number) {
      const entry = state.setAnimation(0, name, false);
      entry.mixDuration = name === "hit" ? 0 : mixData.defaultMix;
      if (duration && entry.animation) entry.timeScale = entry.animation.duration / duration;
      entry.trackTime = elapsed * entry.timeScale;
      entry.mixTime = elapsed;
      if (name !== "death") state.addAnimation(0, "idle", true, 0);
      draw();
    },
    update(delta: number) { state.update(delta); draw(); },
    reset() { idle(); body.style.removeProperty("transform"); },
    destroy() { state.clearTracks(); body.style.removeProperty("transform"); delete body.dataset.spineMesh; },
  };
}

export interface SpinePortraitBinding { update(): void; measure(): void; destroy(): void }
export interface SpinePortraitRenderer {
  attach(control: HTMLElement, actor: ReturnType<typeof createSpineActor>): SpinePortraitBinding;
  render(): void;
  destroy(): void;
}

export function createSpineBattleRig(arena: HTMLElement, renderer?: SpinePortraitRenderer) {
  const actors = new Map<string, ReturnType<typeof createSpineActor>>();
  const portraits = new Map<string, SpinePortraitBinding>();
  let destroyed = false;
  const sync = () => {
    if (destroyed) return;
    const present = new Set<string>();
    for (const control of arena.querySelectorAll<HTMLElement>("[data-combat-actor]")) {
      const body = control.querySelector<HTMLElement>("[data-combat-rig]");
      if (!body || control.dataset.combatStatic === "true") continue;
      const key = control.dataset.combatActor!;
      present.add(key);
      if (actors.get(key)?.body === body) continue;
      portraits.get(key)?.destroy();
      actors.get(key)?.destroy();
      const player = (JSON.parse(key) as [number])[0];
      const phase = [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 28 / 10;
      const actor = createSpineActor(body, player === Number(arena.dataset.combatViewer) ? 1 : -1, phase, control.dataset.combatProfile as RigProfile | undefined);
      actors.set(key, actor);
      if (renderer) portraits.set(key, renderer.attach(control, actor));
    }
    for (const [key, actor] of actors) {
      if (present.has(key)) continue;
      portraits.get(key)?.destroy();
      portraits.delete(key);
      actor.destroy();
      actors.delete(key);
    }
  };
  const tick = (_time: number, delta: number) => {
    if (destroyed || document.hidden) return;
    for (const actor of actors.values()) actor.update(Math.max(0, delta / 1000));
    for (const portrait of portraits.values()) portrait.update();
    renderer?.render();
  };
  const visibility = () => {
    if (document.hidden) {
      gsap.ticker.remove(tick);
      for (const actor of actors.values()) actor.reset();
    } else {
      sync();
      gsap.ticker.add(tick);
    }
  };
  const observer = new MutationObserver(sync);
  observer.observe(arena, { childList: true, subtree: true });
  document.addEventListener("visibilitychange", visibility);
  sync();
  visibility();
  arena.dataset.combatRig = "spine";
  return {
    sync,
    pose(actor: CombatActor, name: Exclude<BattlePose, "idle">, elapsed = 0, duration?: number) {
      actors.get(combatActorKey(actor))?.pose(name, elapsed, duration);
    },
    clear() {
      for (const actor of actors.values()) actor.reset();
      for (const portrait of portraits.values()) portrait.measure();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      gsap.ticker.remove(tick);
      for (const portrait of portraits.values()) portrait.destroy();
      portraits.clear();
      for (const actor of actors.values()) actor.destroy();
      actors.clear();
      delete arena.dataset.combatRig;
    },
  };
}

export type SpineBattleRig = ReturnType<typeof createSpineBattleRig>;
