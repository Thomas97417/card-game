import {
  Animation, AnimationState, AnimationStateData, BoneData, Physics,
  RotateTimeline, ScaleTimeline, Skeleton, SkeletonData, TranslateTimeline,
  type Bone, type Timeline,
} from "@esotericsoftware/spine-core";
import { gsap } from "gsap";
import type { CombatActor } from "./combat-visuals";
import { combatActorKey } from "./combat-visuals";

export type BattlePose = "idle" | "melee" | "ranged" | "cast" | "hit" | "summon" | "death";
type PoseKey = readonly [time: number, x: number, y: number, rotation: number, scaleX: number, scaleY: number];

/** Original two-bone rig. Existing, unsliced art is attached to the body bone in
 * the DOM; Spine owns interpolation, blending and the inherited bone matrix. */
function rigData() {
  const data = new SkeletonData();
  const root = new BoneData(0, "root", null);
  data.bones.push(root, new BoneData(1, "body", root));
  const poses: Record<BattlePose, readonly PoseKey[]> = {
    idle: [[0, 0, 0, -0.4, 1, 1], [1.4, 0, 0.8, 0.5, 1.008, 1.015], [2.8, 0, 0, -0.4, 1, 1]],
    melee: [[0, 0, 0, 0, 1, 1], [0.1, -1, -1, 6, 1.04, 0.95], [0.26, 2, 0, -9, 0.96, 1.06], [0.44, 0, 0, 2, 1.02, 0.99], [0.65, 0, 0, 0, 1, 1]],
    ranged: [[0, 0, 0, 0, 1, 1], [0.12, -1, 0, 5, 0.97, 1.025], [0.26, 0, 0, -4, 1.025, 0.98], [0.55, 0, 0, 0, 1, 1]],
    cast: [[0, 0, 0, 0, 1, 1], [0.16, 0, 1.5, -3, 1.025, 1.05], [0.28, 0, 0.5, 2, 1.04, 0.99], [0.5, 0, 0, 0, 1, 1]],
    hit: [[0, 0, 0, 0, 1, 1], [0.035, -1, -1, 7, 1.08, 0.91], [0.12, 0, 0, -3, 0.98, 1.04], [0.25, 0, 0, 0, 1, 1]],
    summon: [[0, 0, -3, -5, 0.85, 1.12], [0.2, 0, 1, 3, 1.06, 0.96], [0.4, 0, 0, 0, 1, 1]],
    death: [[0, 0, 0, 0, 1, 1], [0.16, -1, -1, 8, 1.03, 0.95], [0.38, -2, -3, 18, 0.95, 0.85]],
  };
  for (const [name, keys] of Object.entries(poses)) {
    const translation = new TranslateTimeline(keys.length, 0, 0);
    const rotation = new RotateTimeline(keys.length, 0, 1);
    const scale = new ScaleTimeline(keys.length, 0, 1);
    keys.forEach(([time, x, y, angle, sx, sy], index) => {
      translation.setFrame(index, time, x, y);
      rotation.setFrame(index, time, angle);
      scale.setFrame(index, time, sx, sy);
    });
    const timelines: Timeline[] = [translation, rotation, scale];
    data.animations.push(new Animation(name, timelines, keys[keys.length - 1]![0]));
  }
  return data;
}

const skeletonData = rigData();
const mixData = new AnimationStateData(skeletonData);
mixData.defaultMix = 0.08;

export function createSpineActor(body: HTMLElement, facing = 1, phase = 0) {
  const skeleton = new Skeleton(skeletonData);
  const state = new AnimationState(mixData);
  const bone: Bone = skeleton.bones[1]!;
  const idle = () => {
    state.clearTracks();
    skeleton.setToSetupPose();
    state.setAnimation(0, "idle", true).trackTime = phase;
  };
  const draw = () => {
    state.apply(skeleton);
    skeleton.updateWorldTransform(Physics.none);
    // Spine uses Y-up; conjugate its bone matrix for CSS's Y-down space.
    body.style.transform = `translate(${facing * bone.worldX}%, ${-bone.worldY}%) matrix(${bone.a}, ${-facing * bone.c}, ${-facing * bone.b}, ${bone.d}, 0, 0)`;
  };
  idle();
  return {
    body,
    pose(name: Exclude<BattlePose, "idle">, elapsed = 0, duration?: number) {
      const entry = state.setAnimation(0, name, false);
      entry.mixDuration = name === "hit" ? 0 : mixData.defaultMix;
      if (duration && entry.animation) entry.timeScale = entry.animation.duration / duration;
      entry.trackTime = elapsed * entry.timeScale;
      if (name !== "death") state.addAnimation(0, "idle", true, 0);
      draw();
    },
    update(delta: number) { state.update(delta); draw(); },
    reset() { idle(); body.style.removeProperty("transform"); },
    destroy() { state.clearTracks(); body.style.removeProperty("transform"); },
  };
}

export function createSpineBattleRig(arena: HTMLElement) {
  const actors = new Map<string, ReturnType<typeof createSpineActor>>();
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
      actors.get(key)?.destroy();
      const player = (JSON.parse(key) as [number])[0];
      const phase = [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 28 / 10;
      actors.set(key, createSpineActor(body, player === Number(arena.dataset.combatViewer) ? 1 : -1, phase));
    }
    for (const [key, actor] of actors) {
      if (present.has(key)) continue;
      actor.destroy();
      actors.delete(key);
    }
  };
  const tick = (_time: number, delta: number) => {
    if (destroyed || document.hidden) return;
    for (const actor of actors.values()) actor.update(Math.min(delta / 1000, 0.05));
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
    clear() { for (const actor of actors.values()) actor.reset(); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      gsap.ticker.remove(tick);
      for (const actor of actors.values()) actor.destroy();
      actors.clear();
      delete arena.dataset.combatRig;
    },
  };
}

export type SpineBattleRig = ReturnType<typeof createSpineBattleRig>;
