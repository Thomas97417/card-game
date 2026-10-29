import * as THREE from "three";
import type { FoundryInput } from "@sylve/game/foundry";

export const FOUNDRY_IMPACT_DELAY_MS = 80;
const facePoint = new THREE.Vector3();

/** Anchor the actual metal end to the aim, with a downward normal at impact. */
export function poseFoundryHammer(
  hammer: { root: THREE.Object3D; strikeFace: THREE.Object3D },
  aim: FoundryInput,
  elapsedMs: number,
) {
  let lift = 1.1, swing = 0;
  if (elapsedMs >= 0 && elapsedMs < 30) lift += 0.2 * elapsedMs / 30;
  else if (elapsedMs >= 30 && elapsedMs <= FOUNDRY_IMPACT_DELAY_MS) {
    swing = ((elapsedMs - 30) / (FOUNDRY_IMPACT_DELAY_MS - 30)) ** 2;
    lift = 1.3 * (1 - swing);
  } else if (elapsedMs > FOUNDRY_IMPACT_DELAY_MS && elapsedMs < 300) {
    const rebound = 1 - (1 - (elapsedMs - FOUNDRY_IMPACT_DELAY_MS) / (300 - FOUNDRY_IMPACT_DELAY_MS)) ** 3;
    swing = 1 - rebound; lift = 1.1 * rebound;
  }
  hammer.root.rotation.set(THREE.MathUtils.lerp(-0.48, -Math.PI / 2, swing), 0, -0.24 * (1 - swing));
  hammer.root.position.set(0, 0, 0);
  hammer.strikeFace.getWorldPosition(facePoint);
  hammer.root.position.set(aim.x, 0.42 + lift, aim.z).sub(facePoint);
}
