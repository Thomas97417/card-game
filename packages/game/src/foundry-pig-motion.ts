import type { FoundryGolemId } from './foundry-golems';
import type { FoundryInput, FoundryRelic, FoundryRound } from './foundry';

/** Numeric settings read from the official browser build 0.2.7.5.2, not its code. */
export const BANK_PIG_MOVEMENT = {
  sourceWidth: 41.900001525878906, boardWidth: 11.2, stepSeconds: .05,
  walkSpeed: [1, 10], zigzagSpeed: [1, 10], zigzagAmplitude: [1, 7], zigzagFrequency: [1.5, 4],
  idleSeconds: [.5, 3], switchSeconds: [1, 5], retargetSeconds: [3, 6],
  acceleration: 8, fleeRadius: 5, fleeSpeed: 10, fleeAcceleration: 10, hopHeight: .5, hopTiltDegrees: 3, hopStride: .1,
} as const;
interface PigMotionProfile {
  reference: 'browser' | 'estimated'; behavior: 'wander' | 'lazy' | 'patrol';
  walk: number; zigzag: number; amplitude: number; frequency: number;
  weights: readonly [number, number, number]; idle?: readonly [number, number]; switch?: readonly [number, number];
  flee: boolean; fleeSpeed?: number; fleeRadius?: number; fleeAcceleration?: number; patrol?: number;
}
export const BANK_PIG_PROFILES: Record<FoundryGolemId, PigMotionProfile> = {
  copper: { reference: 'browser', behavior: 'wander', walk: .5, zigzag: 1, amplitude: 1, frequency: 1, weights: [1.5, .5, .5], flee: false },
  sap: { reference: 'browser', behavior: 'lazy', walk: .3, zigzag: .3, amplitude: .6, frequency: .5, weights: [1.5, .5, 1], idle: [1.5, 6], switch: [1, 4], flee: false },
  stone: { reference: 'browser', behavior: 'wander', walk: .3, zigzag: .3, amplitude: .5, frequency: .5, weights: [2.5, .3, .1], flee: false },
  amber: { reference: 'browser', behavior: 'wander', walk: 1, zigzag: 1, amplitude: 1, frequency: 1, weights: [1, .5, .5], flee: true, fleeSpeed: .9, fleeRadius: 1, fleeAcceleration: 1 },
  shrapnel: { reference: 'browser', behavior: 'patrol', walk: 1.7, zigzag: 2, amplitude: 1, frequency: 1, weights: [1, 0, 0], flee: true, fleeSpeed: 1.8, fleeRadius: .5, fleeAcceleration: 1, patrol: 2 },
  // These five types are absent from the public browser build. Their travel speeds are estimates.
  ember: { reference: 'estimated', behavior: 'wander', walk: .5, zigzag: 1, amplitude: 1, frequency: 1, weights: [1.5, .5, .5], flee: false },
  furnace: { reference: 'estimated', behavior: 'wander', walk: .3, zigzag: .3, amplitude: .5, frequency: .5, weights: [2.5, .3, .1], flee: false },
  thorn: { reference: 'estimated', behavior: 'wander', walk: .3, zigzag: .3, amplitude: .5, frequency: .5, weights: [2.5, .3, .1], flee: false },
  thief: { reference: 'estimated', behavior: 'wander', walk: 1, zigzag: 1, amplitude: 1, frequency: 1, weights: [1, .5, .25], flee: true, fleeSpeed: 1.5, fleeRadius: 1, fleeAcceleration: 1 },
  reinforcement: { reference: 'estimated', behavior: 'wander', walk: .7, zigzag: .7, amplitude: 1, frequency: 1, weights: [1.5, .3, .25], flee: false },
};
export interface BankPigMotion {
  mode: 'walk' | 'zigzag' | 'idle' | 'patrol'; until: number; rng: number;
  heading: number; speed: number; amplitude: number; frequency: number; distance: number;
}
export const bankPigStepSpeed = (sourceSpeed: number) => sourceSpeed * BANK_PIG_MOVEMENT.boardWidth / BANK_PIG_MOVEMENT.sourceWidth * BANK_PIG_MOVEMENT.stepSeconds;

function random(motion: BankPigMotion) {
  let x = motion.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; motion.rng = x >>> 0;
  return motion.rng / 4294967296;
}
const range = (motion: BankPigMotion, bounds: readonly [number, number]) => bounds[0] + random(motion) * (bounds[1] - bounds[0]);

/** Separate persisted movement RNG keeps turns, rests and speeds reproducible without consuming loot draws. */
export function moveBankPigs(state: FoundryRound, input: FoundryInput) {
  const config = BANK_PIG_MOVEMENT;
  for (const target of state.targets) {
    if (!target.golem) continue;
    const profile = BANK_PIG_PROFILES[target.golem];
    const motion = target.motion ??= { mode: 'walk', until: 0, rng: (Math.imul(target.id, 2654435761) ^ Math.round(target.phase * 1e8)) >>> 0 || 1,
      heading: Math.atan2(target.vz, target.vx), speed: 0, amplitude: 0, frequency: 0, distance: 0 };
    if (state.tick >= motion.until) {
      const weight = random(motion) * profile.weights.reduce((a, b) => a + b, 0);
      motion.mode = profile.behavior === 'patrol' ? 'patrol' : profile.behavior === 'lazy' && motion.until === 0 ? 'idle'
        : weight < profile.weights[0] ? 'walk' : weight < profile.weights[0] + profile.weights[1] ? 'zigzag' : 'idle';
      motion.speed = motion.mode === 'idle' ? 0 : range(motion, motion.mode === 'zigzag' ? config.zigzagSpeed : config.walkSpeed)
        * (motion.mode === 'patrol' ? profile.patrol! : motion.mode === 'zigzag' ? profile.zigzag : profile.walk);
      motion.amplitude = range(motion, config.zigzagAmplitude) * profile.amplitude;
      motion.frequency = range(motion, config.zigzagFrequency) * profile.frequency;
      const duration = range(motion, motion.mode === 'idle' ? profile.idle ?? config.idleSeconds : profile.switch ?? config.switchSeconds);
      motion.until = state.tick + Math.max(1, Math.ceil(duration / config.stepSeconds));
      // Patrol preserves its heading between walls. Wanderers select a new direction at each change.
      if (motion.mode === 'walk' || motion.mode === 'zigzag') motion.heading = random(motion) * Math.PI * 2;
    }
    let heading = motion.heading, speed = motion.speed, acceleration = config.acceleration;
    if (motion.mode === 'zigzag') heading += Math.sin(state.tick * config.stepSeconds * motion.frequency + target.phase) * Math.atan2(motion.amplitude, Math.max(1, motion.speed));
    if (profile.flee && input.active && Math.hypot(target.x - input.x, target.z - input.z) < config.fleeRadius * (profile.fleeRadius ?? 1) * config.boardWidth / config.sourceWidth) {
      heading = Math.atan2(target.z - input.z, target.x - input.x); speed = config.fleeSpeed * (profile.fleeSpeed ?? 1); acceleration = config.fleeAcceleration * (profile.fleeAcceleration ?? 1);
    }
    if (target.golem === 'ember' && (target.rageUntil ?? 0) > state.tick) {
      const neighbour = state.targets.filter(t => t.id !== target.id).sort((a, b) => Math.hypot(a.x - target.x, a.z - target.z) - Math.hypot(b.x - target.x, b.z - target.z) || a.id - b.id)[0];
      if (neighbour) heading = Math.atan2(neighbour.z - target.z, neighbour.x - target.x);
      speed = Math.max(speed, config.fleeSpeed);
    }
    if (target.golem === 'thief' && (target.stolen ?? 0) > 0) {
      heading = Math.abs(target.x) / (config.boardWidth / 2) > Math.abs(target.z) / 3.4 ? (target.x < 0 ? Math.PI : 0) : (target.z < 0 ? -Math.PI / 2 : Math.PI / 2);
      speed = config.fleeSpeed * 1.5;
    }
    const desiredX = Math.cos(heading) * bankPigStepSpeed(speed), desiredZ = Math.sin(heading) * bankPigStepSpeed(speed);
    const dx = desiredX - target.vx, dz = desiredZ - target.vz, length = Math.hypot(dx, dz);
    const amount = Math.min(1, bankPigStepSpeed(acceleration) * config.stepSeconds / Math.max(1e-9, length));
    target.vx += dx * amount; target.vz += dz * amount;
    if (Math.hypot(target.vx, target.vz) < .00001) target.vx = target.vz = 0;
    motion.distance += Math.hypot(target.vx, target.vz);
  }
}

export function reflectBankPig(target: FoundryRelic) {
  if (target.motion && (target.vx || target.vz)) target.motion.heading = Math.atan2(target.vz, target.vx);
}
