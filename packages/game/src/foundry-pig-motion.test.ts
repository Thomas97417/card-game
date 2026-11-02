import { describe, expect, it } from 'vitest';
import { createFoundryRound, newFoundryCycle, spawnFoundryRelic, stepFoundry, FOUNDRY, RELICS, type FoundryGolemId } from './foundry';
import { BANK_PIG_MOVEMENT as M, BANK_PIG_PROFILES, bankPigStepSpeed, moveBankPigs } from './foundry-pig-motion';

const miss = { x: 5.6, z: 3.4, active: false };
function arena(id: FoundryGolemId) {
  const r = createFoundryRound(913, newFoundryCycle(), 'mallet');
  r.targets = []; r.targets = [{ ...spawnFoundryRelic(r, id), x: 0, z: 0, phase: .2 }]; r.nextStrike = 1e9;
  return r;
}

describe('les déplacements des tirelires V15', () => {
  it('converts source units per second into board units per fixed step without changing traversal time', () => {
    for (const speed of [.3, 1, 2.75, 5, 10, 18]) {
      expect(FOUNDRY.width / (bankPigStepSpeed(speed) * 1000 / FOUNDRY.stepMs)).toBeCloseTo(M.sourceWidth / speed, 10);
    }
    expect(BANK_PIG_PROFILES.copper.walk).toBe(.5);
    expect(BANK_PIG_PROFILES.sap).toMatchObject({ walk: .3, idle: [1.5, 6], flee: false });
    expect(BANK_PIG_PROFILES.stone.walk).toBe(.3);
    expect(BANK_PIG_PROFILES.shrapnel).toMatchObject({ behavior: 'patrol', patrol: 2, weights: [1, 0, 0] });
  });
  it('keeps the lazy Tourist still on arrival, even with the hammer right next to it', () => {
    const r = arena('sap');
    moveBankPigs(r, { x: .1, z: .1, active: true });
    const t = r.targets[0]!;
    expect([t.vx, t.vz]).toEqual([0, 0]); expect(t.motion!.mode).toBe('idle');
    expect(t.motion!.until).toBeGreaterThanOrEqual(30); expect(t.motion!.until).toBeLessThanOrEqual(120);
    const still = structuredClone(r);
    for (let i = 0; i < 20; i++) {
      r.tick++; still.tick++; moveBankPigs(r, { x: .1, z: .1, active: true }); moveBankPigs(still, miss);
    }
    expect(r.targets).toEqual(still.targets);
  });
  it('keeps the sergeant on a straight patrol and reflects at walls without sticking', () => {
    const r = arena('shrapnel'), t = r.targets[0]!;
    t.motion = { mode: 'patrol', until: 1e6, rng: 91, heading: 0, speed: 4, amplitude: 0, frequency: 0, distance: 0 };
    for (let i = 0; i < 15; i++) stepFoundry(r, miss);
    expect(t.x).toBeGreaterThan(0); expect(t.z).toBeCloseTo(0);
    const edge = FOUNDRY.width / 2 - RELICS[t.kind].radius * FOUNDRY.fullRelicScale;
    t.x = edge - .001; t.vx = bankPigStepSpeed(4);
    stepFoundry(r, miss); expect(t.vx).toBeLessThan(0);
    stepFoundry(r, miss); expect(t.x).toBeLessThan(edge); expect(t.vx).toBeLessThan(0);
  });
  it('replays movement changes, rests and flee state through a JSON checkpoint without spending loot RNG', () => {
    const r = arena('amber'), rng = r.rng;
    for (let i = 0; i < 80; i++) stepFoundry(r, miss);
    expect(r.rng).toBe(rng);
    const resumed = JSON.parse(JSON.stringify(r));
    for (let i = 0; i < 600; i++) {
      const input = i % 30 < 15 ? { x: r.targets[0]!.x + .1, z: r.targets[0]!.z, active: true } : miss;
      expect(stepFoundry(resumed, input)).toEqual(stepFoundry(r, input));
    }
    expect(resumed).toEqual(r); expect(r.targets[0]!.motion!.distance).toBeGreaterThan(0);
  });
  it('freezes both positions and distance-based animation until the effect ends', () => {
    const r = arena('copper'); stepFoundry(r, miss);
    r.rogue!.frozenUntil = r.tick + 20;
    const before = structuredClone(r.targets);
    for (let i = 0; i < 10; i++) stepFoundry(r, miss);
    expect(r.targets).toEqual(before);
  });
});
