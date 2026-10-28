import {
  Animation, BoneData, MeshAttachment, RotateTimeline, ScaleTimeline,
  SkeletonData, SlotData, TranslateTimeline, type Timeline,
} from "@esotericsoftware/spine-core";
import type { RigProfile } from "./combat-rig-profile";
export type { RigProfile } from "./combat-rig-profile";
export type BattlePose = "idle" | "melee" | "ranged" | "cast" | "hit" | "summon" | "death";
type PoseKey = readonly [time: number, x: number, y: number, rotation: number, scaleX: number, scaleY: number];
type Joint = {
  name: string; parent: string; x: number; y: number;
  zone: readonly [x: number, y: number, radiusX: number, radiusY: number];
  motion: "torso" | "head" | "arm" | "forearm" | "leg" | "shin" | "tail" | "wing";
  side?: number;
};

const humanoid: Joint[] = [
  { name: "pelvis", parent: "body", x: 0.52, y: 0.32, zone: [0.52, 0.35, 0.2, 0.15], motion: "torso" },
  { name: "chest", parent: "pelvis", x: 0.51, y: 0.49, zone: [0.51, 0.57, 0.2, 0.18], motion: "torso" },
  { name: "head", parent: "chest", x: 0.51, y: 0.72, zone: [0.51, 0.81, 0.18, 0.14], motion: "head" },
  ...([-1, 1] as const).flatMap((side): Joint[] => [
    { name: `arm${side}`, parent: "chest", x: 0.51 + side * 0.19, y: 0.66, zone: [0.51 + side * 0.23, 0.56, 0.11, 0.16], motion: "arm", side },
    { name: `forearm${side}`, parent: `arm${side}`, x: 0.51 + side * 0.26, y: 0.46, zone: [0.51 + side * 0.3, 0.35, 0.15, 0.17], motion: "forearm", side },
    { name: `leg${side}`, parent: "pelvis", x: 0.52 + side * 0.13, y: 0.32, zone: [0.52 + side * 0.16, 0.25, 0.12, 0.13], motion: "leg", side },
    { name: `shin${side}`, parent: `leg${side}`, x: 0.52 + side * 0.2, y: 0.18, zone: [0.52 + side * 0.24, 0.1, 0.15, 0.1], motion: "shin", side },
  ]),
];
const quadruped: Joint[] = [
  { name: "chest", parent: "body", x: 0.47, y: 0.36, zone: [0.48, 0.43, 0.29, 0.17], motion: "torso" },
  { name: "neck", parent: "chest", x: 0.67, y: 0.47, zone: [0.7, 0.53, 0.16, 0.17], motion: "torso" },
  { name: "head", parent: "neck", x: 0.77, y: 0.57, zone: [0.8, 0.63, 0.17, 0.16], motion: "head" },
  ...([-1, 1] as const).flatMap((side): Joint[] => [
    { name: `leg${side}`, parent: "chest", x: side === 1 ? 0.69 : 0.35, y: 0.35, zone: [side === 1 ? 0.71 : 0.32, 0.28, 0.12, 0.12], motion: "leg", side },
    { name: `shin${side}`, parent: `leg${side}`, x: side === 1 ? 0.76 : 0.29, y: 0.2, zone: [side === 1 ? 0.79 : 0.27, 0.14, 0.15, 0.09], motion: "shin", side },
  ]),
  { name: "tail", parent: "chest", x: 0.26, y: 0.39, zone: [0.19, 0.39, 0.15, 0.13], motion: "tail" },
  { name: "tail-tip", parent: "tail", x: 0.13, y: 0.4, zone: [0.08, 0.45, 0.12, 0.17], motion: "tail", side: -1 },
];
const profiles: Record<RigProfile, Joint[]> = {
  humanoid,
  quadruped,
  winged: [...quadruped,
    { name: "wing", parent: "chest", x: 0.5, y: 0.51, zone: [0.4, 0.59, 0.16, 0.15], motion: "wing" },
    { name: "wing-tip", parent: "wing", x: 0.35, y: 0.61, zone: [0.24, 0.65, 0.18, 0.13], motion: "wing", side: -1 },
  ],
  avian: [
    { name: "chest", parent: "body", x: 0.5, y: 0.35, zone: [0.5, 0.47, 0.23, 0.23], motion: "torso" },
    { name: "head", parent: "chest", x: 0.5, y: 0.67, zone: [0.5, 0.78, 0.23, 0.2], motion: "head" },
    ...([-1, 1] as const).map((side): Joint => ({ name: `wing${side}`, parent: "chest", x: 0.5 + side * 0.16, y: 0.56, zone: [0.5 + side * 0.3, 0.43, 0.17, 0.25], motion: "wing", side })),
    { name: "tail", parent: "chest", x: 0.5, y: 0.3, zone: [0.5, 0.17, 0.2, 0.17], motion: "tail" },
  ],
  serpent: [
    { name: "tail", parent: "body", x: 0.25, y: 0.14, zone: [0.22, 0.15, 0.26, 0.18], motion: "tail" },
    { name: "coil", parent: "tail", x: 0.45, y: 0.3, zone: [0.46, 0.32, 0.25, 0.18], motion: "torso" },
    { name: "chest", parent: "coil", x: 0.59, y: 0.5, zone: [0.59, 0.54, 0.18, 0.18], motion: "torso" },
    { name: "head", parent: "chest", x: 0.63, y: 0.7, zone: [0.63, 0.8, 0.24, 0.18], motion: "head" },
  ],
  plant: [
    { name: "trunk", parent: "body", x: 0.5, y: 0.12, zone: [0.5, 0.29, 0.22, 0.19], motion: "torso" },
    { name: "chest", parent: "trunk", x: 0.5, y: 0.42, zone: [0.5, 0.52, 0.22, 0.21], motion: "torso" },
    { name: "head", parent: "chest", x: 0.5, y: 0.67, zone: [0.5, 0.79, 0.31, 0.18], motion: "head" },
    ...([-1, 1] as const).map((side): Joint => ({ name: `branch${side}`, parent: "chest", x: 0.5 + side * 0.16, y: 0.5, zone: [0.5 + side * 0.3, 0.5, 0.2, 0.22], motion: "arm", side })),
  ],
  spirit: humanoid.filter((joint) => joint.motion !== "leg" && joint.motion !== "shin").concat([
    { name: "tail", parent: "pelvis", x: 0.5, y: 0.3, zone: [0.5, 0.16, 0.28, 0.2], motion: "tail" },
  ]),
};

const poses: Record<BattlePose, readonly PoseKey[]> = {
  idle: [[0, 0, 0, -0.4, 1, 1], [1.4, 0, 0.8, 0.5, 1.008, 1.015], [2.8, 0, 0, -0.4, 1, 1]],
  melee: [[0, 0, 0, 0, 1, 1], [0.1, -1, -1.5, 7, 1.035, 0.95], [0.2, 1, 2, -5, 0.98, 1.04], [0.26, 2, 0, -12, 0.97, 1.06], [0.32, 2.3, -0.5, -9, 1.02, 0.99], [0.52, 0, 0, 3, 1.015, 0.99], [0.75, 0, 0, 0, 1, 1]],
  ranged: [[0, 0, 0, 0, 1, 1], [0.13, -1, 0, 5, 0.98, 1.025], [0.21, -0.5, 0, 4, 1, 1.02], [0.26, 0.8, 0, -5, 1.02, 0.98], [0.55, 0, 0, 0, 1, 1]],
  cast: [[0, 0, 0, 0, 1, 1], [0.16, 0, 2, -4, 1.02, 1.04], [0.28, 0, 0.5, 3, 1.04, 0.99], [0.5, 0, 0, 0, 1, 1]],
  hit: [[0, 0, 0, 0, 1, 1], [0.035, -1, -1, 7, 1.08, 0.91], [0.12, 0, 0, -3, 0.98, 1.04], [0.25, 0, 0, 0, 1, 1]],
  summon: [[0, 0, -3, -5, 1, 1], [0.2, 0, 1, 3, 1.02, 0.98], [0.4, 0, 0, 0, 1, 1]],
  death: [[0, 0, 0, 0, 1, 1], [0.16, -1, -1, 8, 1.03, 0.95], [0.38, -2, -3, 18, 0.95, 0.85]],
};
const motionAngles: Record<Joint["motion"], Record<BattlePose, readonly number[]>> = {
  torso: { idle: [-0.5, 0.5, -0.5], melee: [0, 3, -3, -6, -4, 2, 0], ranged: [0, 2, 2, -4, 0], cast: [0, -3, 3, 0], hit: [0, 6, -3, 0], summon: [8, -4, 0], death: [0, 8, 16] },
  head: { idle: [1, -1, 1], melee: [0, -5, 6, 7, 3, -3, 0], ranged: [0, -3, -3, 4, 0], cast: [0, 6, -3, 0], hit: [0, -11, 4, 0], summon: [-8, 4, 0], death: [0, -8, -16] },
  arm: { idle: [-1, 1, -1], melee: [0, 24, 8, -32, -24, 9, 0], ranged: [0, -19, -22, 12, 0], cast: [0, 27, -12, 0], hit: [0, 9, -4, 0], summon: [15, -8, 0], death: [0, 12, 27] },
  forearm: { idle: [1.5, -1.5, 1.5], melee: [0, 25, 12, -30, -20, 8, 0], ranged: [0, 27, 31, -15, 0], cast: [0, -22, 16, 0], hit: [0, -14, 5, 0], summon: [-12, 8, 0], death: [0, -10, -22] },
  leg: { idle: [0.3, -0.3, 0.3], melee: [0, -10, 15, -13, -9, 9, 0], ranged: [0, -5, -5, 6, 0], cast: [0, -5, 3, 0], hit: [0, -9, 5, 0], summon: [-12, 7, 0], death: [0, -7, -19] },
  shin: { idle: [-0.3, 0.3, -0.3], melee: [0, 15, -12, 17, 11, -8, 0], ranged: [0, 4, 4, -3, 0], cast: [0, 4, -2, 0], hit: [0, 11, -4, 0], summon: [15, -6, 0], death: [0, 12, 25] },
  tail: { idle: [-4, 4, -4], melee: [0, -14, 18, 21, 13, -10, 0], ranged: [0, -9, -12, 15, 0], cast: [0, -12, 16, 0], hit: [0, -17, 8, 0], summon: [-18, 12, 0], death: [0, 10, 25] },
  wing: { idle: [-3, 3, -3], melee: [0, 16, -23, -14, -8, 13, 0], ranged: [0, 18, 22, -21, 0], cast: [0, 24, -22, 0], hit: [0, 18, -9, 0], summon: [28, -20, 0], death: [0, 20, 32] },
};
const cache = new Map<string, ReturnType<typeof buildRig>>();

/** Spine weighted attachment; local bind coordinates reproduce the source art
 * exactly at rest, and up to three joints independently deform each vertex. */
function buildRig(profile: RigProfile, aspect: number) {
  const data = new SkeletonData();
  const root = new BoneData(0, "root", null);
  const body = new BoneData(1, "body", root);
  data.bones.push(root, body);
  const height = 100 * aspect;
  const joints = profiles[profile];
  const bind = new Map<string, { x: number; y: number }>([["body", { x: 0, y: 0 }]]);
  for (const joint of joints) {
    const parent = data.findBone(joint.parent)!;
    const point = { x: (joint.x - 0.5) * 100, y: joint.y * height };
    const origin = bind.get(joint.parent)!;
    const bone = new BoneData(data.bones.length, joint.name, parent);
    bone.x = point.x - origin.x;
    bone.y = point.y - origin.y;
    data.bones.push(bone);
    bind.set(joint.name, point);
  }
  data.slots.push(new SlotData(0, "portrait", body));
  for (const [name, keys] of Object.entries(poses) as [BattlePose, readonly PoseKey[]][]) {
    const translation = new TranslateTimeline(keys.length, 0, 0);
    const rotation = new RotateTimeline(keys.length, 0, 1);
    const scale = new ScaleTimeline(keys.length, 0, 1);
    keys.forEach(([time, x, y, angle, sx, sy], index) => {
      translation.setFrame(index, time, x, y);
      rotation.setFrame(index, time, angle);
      scale.setFrame(index, time, sx, sy);
    });
    const timelines: Timeline[] = [translation, rotation, scale];
    joints.forEach((joint, index) => {
      const timeline = new RotateTimeline(keys.length, 0, index + 2);
      keys.forEach(([time], frame) => timeline.setFrame(frame, time, motionAngles[joint.motion][name][frame]! * (joint.side ?? 1)));
      timelines.push(timeline);
    });
    data.animations.push(new Animation(name, timelines, keys[keys.length - 1]![0]));
  }
  const mesh = new MeshAttachment("portrait", "portrait");
  const columns = 12;
  const rows = 14;
  const uvs: number[] = [];
  const vertices: number[] = [];
  mesh.bones = [];
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const u = column / columns;
      const v = row / rows;
      uvs.push(u, 1 - v);
      const weights = joints.map((joint, index) => {
        const [cx, cy, rx, ry] = joint.zone;
        const distance = ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2;
        return { index, weight: Math.exp(-distance * 1.8) };
      }).sort((a, b) => b.weight - a.weight).slice(0, 3);
      const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
      mesh.bones.push(weights.length);
      for (const { index, weight } of weights) {
        const origin = bind.get(joints[index]!.name)!;
        mesh.bones.push(index + 2);
        vertices.push((u - 0.5) * 100 - origin.x, v * height - origin.y, weight / total);
      }
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column;
        mesh.triangles.push(a, a + 1, a + columns + 1, a + 1, a + columns + 2, a + columns + 1);
      }
    }
  }
  mesh.vertices = new Float32Array(vertices);
  mesh.worldVerticesLength = uvs.length;
  mesh.regionUVs = new Float32Array(uvs);
  return { data, mesh, height };
}

export function spineRigData(profile: RigProfile = "humanoid", aspect = 1) {
  const key = `${profile}:${aspect}`;
  let rig = cache.get(key);
  if (!rig) { rig = buildRig(profile, aspect); cache.set(key, rig); }
  return rig;
}
